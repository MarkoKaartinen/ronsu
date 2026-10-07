import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Page, server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

test('a thread opens from tapping a card and going back restores the scroll position', async ({ page }) => {
  await open(page, { marker: null, posts: [] });

  await page.evaluate(() => window.scrollTo(0, 2500));
  await page.waitForTimeout(200);
  const yBefore = await page.evaluate(() => Math.round(scrollY));
  const idAt = await page.evaluate(() => {
    const bar = document.querySelector('.bar')!.getBoundingClientRect().bottom;
    return [...document.querySelectorAll<HTMLElement>('article[data-id]')].find((a) => a.getBoundingClientRect().bottom - bar >= 48)!.dataset.id!;
  });

  // Tapping the card opens the thread. DOM click: Playwright's own scrolling (out from under the sticky
  // bar) would change the position being measured
  await page.locator(`article[data-id="${idAt}"]`).evaluate((el: HTMLElement) => el.click());
  await expect(page).toHaveURL(new RegExp(`#/thread/${idAt}$`));
  // 2 ancestors + the selected post + 2 replies
  await expect(page.locator('article[data-id]:visible')).toHaveCount(5);
  await expect(page.locator('[data-focused] article')).toHaveAttribute('data-id', idAt);
  // The selected post is scrolled into view (to the top, under the sticky header)
  await expect.poll(() => page.locator('[data-focused]').evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(120);

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).not.toHaveURL(/#\/thread/);
  await expect(page.locator('article[data-id]:visible').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBeGreaterThan(yBefore - 5);
  expect(Math.abs((await page.evaluate(() => Math.round(scrollY))) - yBefore)).toBeLessThan(5);
});

test('reply: prefill, retry with the same key, CW and visibility', async ({ page }) => {
  const server: Server = { marker: null, posts: [], created: [], attempts: [] };
  await open(page, server);
  const id = idOf(150);
  await page.evaluate((i) => (location.hash = `/thread/${i}`), id);
  await expect(page.locator('[data-focused] article')).toBeVisible();

  await page.locator('[data-focused]').getByRole('button', { name: 'Reply' }).click();
  const dialog = page.getByRole('dialog');
  const box = dialog.getByRole('textbox', { name: /on your mind/ });
  await expect(box).toHaveValue('@u ');
  await expect(dialog.getByRole('button', { name: 'Post' })).toBeDisabled(); // a bare mention is not enough

  // A failed post: the form stays open and the text is kept
  server.failPost = true;
  await box.fill('@u Thanks for the tip!');
  await dialog.getByRole('button', { name: 'Post' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Server refused');
  await expect(box).toHaveValue('@u Thanks for the tip!');

  // Retry: the same Idempotency-Key, CW and followers-only visibility
  server.failPost = false;
  await dialog.getByRole('button', { name: 'Content warning' }).click();
  await dialog.getByRole('textbox', { name: 'Content warning' }).fill('Spoiler');
  await dialog.getByRole('combobox', { name: 'Visibility' }).selectOption('private');
  await dialog.getByRole('button', { name: 'Post' }).click();
  await expect(dialog).toBeHidden();

  expect(server.created).toHaveLength(1);
  expect(server.created![0].body).toMatchObject({
    status: '@u Thanks for the tip!',
    in_reply_to_id: id,
    spoiler_text: 'Spoiler',
    visibility: 'private',
  });
  expect(server.attempts).toHaveLength(2);
  expect(server.attempts![0]).toBeTruthy();
  expect(server.attempts![0]).toBe(server.attempts![1]);

  // The thread refreshes: the own reply shows up and the reply counter grew
  await expect(page.locator('article[data-id]:visible')).toHaveCount(6);
  await expect(page.locator('[data-focused] .stats')).toContainText('1 reply');
  await expect(page.locator('[data-focused] .stats')).toContainText('1 quote');
});

test('a new post without a reply target is public by default', async ({ page }) => {
  const server: Server = { marker: null, posts: [], created: [], attempts: [] };
  await open(page, server);
  await page.getByRole('button', { name: 'New post' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox', { name: /on your mind/ })).toHaveValue('');
  await expect(dialog.getByRole('combobox', { name: 'Visibility' })).toHaveValue('public');
  await dialog.getByRole('textbox', { name: /on your mind/ }).fill('Hello world');
  await dialog.getByRole('textbox', { name: /on your mind/ }).press('Control+Enter');
  await expect(dialog).toBeHidden();
  expect(server.created![0].body).toMatchObject({ status: 'Hello world', visibility: 'public' });
  expect(server.created![0].body).not.toHaveProperty('in_reply_to_id');
  expect(server.created![0].body).not.toHaveProperty('spoiler_text');
});

test('the language is chosen and remembered, a backdrop click closes the form', async ({ page }) => {
  const server: Server = { marker: null, posts: [], created: [], attempts: [] };
  await page.setViewportSize({ width: 900, height: 800 }); // the form is a sheet with a backdrop only on a wide screen
  await open(page, server);
  await page.evaluate(() => localStorage.removeItem('compose-language'));

  await page.getByRole('button', { name: 'New post' }).first().click();
  const dialog = page.getByRole('dialog');
  const lang = dialog.getByRole('combobox', { name: 'Language' });
  await lang.selectOption('sv');
  await dialog.getByRole('textbox', { name: /on your mind/ }).fill('Hej!');
  await dialog.getByRole('button', { name: 'Post' }).click();
  await expect(dialog).toBeHidden();
  expect(server.created![0].body).toMatchObject({ status: 'Hej!', language: 'sv' });

  // Next time the previous choice is the default
  await page.getByRole('button', { name: 'New post' }).first().click();
  await expect(lang).toHaveValue('sv');

  // An empty form closes on a backdrop click
  await page.mouse.click(4, 4);
  await expect(dialog).toBeHidden();

  // An unfinished message: a confirmation; "no" keeps the form open, "yes" closes it
  await page.getByRole('button', { name: 'New post' }).first().click();
  await dialog.getByRole('textbox', { name: /on your mind/ }).fill('unfinished');
  page.once('dialog', (d) => d.dismiss());
  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.mouse.click(4, 4);
  await expect(dialog).toBeHidden();
  expect(server.created).toHaveLength(1);
});

test('selecting text in the form and releasing over the backdrop does not close the form', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  await page.getByRole('button', { name: 'New post' }).first().click();
  const dialog = page.getByRole('dialog');
  const box = dialog.getByRole('textbox', { name: /on your mind/ });
  await box.fill('select this');
  const b = (await box.boundingBox())!;
  await page.mouse.move(b.x + 20, b.y + 10);
  await page.mouse.down();
  await page.mouse.move(4, 4); // drag out onto the backdrop
  await page.mouse.up();
  await expect(dialog).toBeVisible();
});

test('a content warning is drawn in the warning colour and is visible on the selected post too', async ({ page }) => {
  await open(page, { marker: null, posts: [], cw: true });
  const id = idOf(150); // 150 % 4 === 2: it has a content warning
  await page.evaluate((i) => (location.hash = `/thread/${i}`), id);
  await expect(page.locator('[data-focused] article')).toBeVisible();

  const cw = page.locator('[data-focused] .cw');
  await expect(cw).toContainText('food talk');
  await expect(cw.getByRole('button', { name: 'Show post' })).toBeVisible();

  // Not the same colour as the band behind it (the box used to sink into the selected post's background)
  const [box, band] = await Promise.all([
    cw.evaluate((el) => getComputedStyle(el).backgroundColor),
    page.locator('[data-focused] article').evaluate((el) => getComputedStyle(el).backgroundColor),
  ]);
  expect(box).not.toBe(band);
  expect(box).not.toBe('rgba(0, 0, 0, 0)');

  // The body stays hidden until the button is pressed
  await expect(page.locator('[data-focused] .content')).toHaveCount(0);
  await cw.getByRole('button', { name: 'Show post' }).click();
  await expect(page.locator('[data-focused] .content')).toBeVisible();
});

test('on a phone the form fills the screen and its tools are small, named controls', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  await page.getByRole('button', { name: 'New post' }).first().click();
  const dialog = page.getByRole('dialog');
  const box = await dialog.boundingBox();
  const vp = page.viewportSize()!;
  expect(box).toMatchObject({ x: 0, y: 0, width: vp.width, height: vp.height });
  // The tools sit at the bottom edge and have no visible captions, only accessible names
  for (const name of ['Visibility', 'Language']) await expect(dialog.getByRole('combobox', { name })).toBeAttached();
  await expect(dialog.getByRole('button', { name: /content warning|CW/i })).toBeVisible();
  const tools = await dialog.locator('.tools').boundingBox();
  expect(tools!.y + tools!.height).toBeGreaterThan(vp.height - 40);
  expect(tools!.height).toBeLessThan(70);
});

test('the quote inside the selected post stands out from the post\'s background band', async ({ page }) => {
  await open(page, { marker: null, posts: [], quoteAll: true });
  const id = await page.locator('article[data-id]').first().getAttribute('data-id');
  await page.locator(`article[data-id="${id}"]`).evaluate((el: HTMLElement) => el.click());
  await expect(page.locator('[data-focused] > article')).toHaveAttribute('data-id', id!);
  const frame = page.locator('[data-focused] article.quoted');
  await expect(frame).toBeVisible();
  const bg = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg('[data-focused] article.quoted')).not.toBe(await bg('[data-focused] > article'));
});

test('a short content warning keeps the button beside it, a long one puts the button below it', async ({ page }) => {
  for (const cwLong of [false, true]) {
    await open(page, { marker: null, posts: [], cw: true, cwLong });
    await page.evaluate((i) => (location.hash = `/thread/${i}`), idOf(150));
    const cw = page.locator('[data-focused] .cw');
    await expect(cw).toBeVisible();
    const button = cw.getByRole('button', { name: 'Show post' });
    await expect(button).toHaveText('Show');
    await expect(button.locator('svg')).toBeVisible();
    const [text, box] = await Promise.all([
      cw.locator('.cw-text').evaluate((el) => el.getBoundingClientRect()),
      button.evaluate((el) => el.getBoundingClientRect()),
    ]);
    if (cwLong) {
      expect(box.top).toBeGreaterThanOrEqual(text.bottom - 1);
      expect(Math.abs(box.left - text.left)).toBeLessThan(2); // below, at the left edge
    } else expect(box.left).toBeGreaterThan(text.right - 1);
  }
});
