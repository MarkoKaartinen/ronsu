import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Page, server: Server, order?: 'newest-first') {
  if (order) await page.addInitScript((o) => localStorage.setItem('reading-order', o), order);
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.waitForTimeout(300);
}

const newServer = (): Server => ({ marker: null, posts: [], actions: [], total: 200 });
const focusedId = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.id ?? null);

test('j and k move through the posts in the order they are shown, oldest first', async ({ page }) => {
  await open(page, newServer());
  const ids = await page.locator('article[data-id]').evaluateAll((els) => els.slice(0, 3).map((e) => (e as HTMLElement).dataset.id!));
  await page.keyboard.press('j');
  const first = await focusedId(page);
  expect(ids).toContain(first);
  await page.keyboard.press('j');
  expect(await focusedId(page)).toBe(ids[ids.indexOf(first!) + 1]);
  await page.keyboard.press('k');
  expect(await focusedId(page)).toBe(first);
});

test('newest first: j goes down the screen, to the older post', async ({ page }) => {
  await open(page, newServer(), 'newest-first');
  await page.keyboard.press('j');
  const first = BigInt((await focusedId(page))!);
  await page.keyboard.press('j');
  expect(BigInt((await focusedId(page))!)).toBeLessThan(first);
  await page.keyboard.press('k'); // and k goes back up, to the newer post
  expect(BigInt((await focusedId(page))!)).toBe(first);
});

test('newest first: l loads older posts at the bottom', async ({ page }) => {
  await open(page, newServer(), 'newest-first');
  const oldest = () => page.locator('article[data-id]').evaluateAll((els) => BigInt((els.at(-1) as HTMLElement).dataset.id!));
  const before = await oldest();
  await page.keyboard.press('l');
  await expect.poll(oldest).toBeLessThan(before);
});

test('k at the first post shows the button that loads new posts, j at the last one the one below', async ({ page }) => {
  const server = newServer();
  server.total = 140;
  await open(page, server, 'newest-first');
  const loadNew = page.getByRole('button', { name: 'Load new' });
  const loadMore = page.getByRole('button', { name: 'Load more' });

  // The first post is at the top of the screen, which hides the button above it; k brings it back, and the page stays at the top
  await page.keyboard.press('j');
  await page.locator('article[data-id]').first().evaluate((el: HTMLElement) => el.focus());
  await page.keyboard.press('k');
  await expect(loadNew).toBeInViewport();
  await expect(loadMore).not.toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBeLessThan(300);

  // The last post of the list: the button under it
  await page.locator('article[data-id]').last().evaluate((el: HTMLElement) => el.focus());
  await page.keyboard.press('j');
  await expect(loadMore).toBeInViewport();
  await expect(loadNew).not.toBeInViewport();
});

test('r, f, b and d press the buttons of the post that has the focus', async ({ page }) => {
  const server = newServer();
  await open(page, server);
  await page.keyboard.press('j');
  const card = page.locator('article[data-id]:focus');
  await page.keyboard.press('f');
  await expect(card.getByRole('button', { name: 'Favorite' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('b');
  await expect(card.getByRole('button', { name: 'Boost' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('d');
  await expect(card.getByRole('button', { name: 'Bookmark' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('f');
  await expect(card.getByRole('button', { name: 'Favorite' })).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('r');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('o opens the thread, backspace goes back, n opens a new post', async ({ page }) => {
  await open(page, newServer());
  await page.keyboard.press('j');
  const id = await focusedId(page);
  await page.keyboard.press('o');
  await expect(page).toHaveURL(new RegExp(`#/thread/\\d+`));
  await page.keyboard.press('Backspace');
  await expect(page).not.toHaveURL(/thread/);
  expect(id).toBeTruthy();
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('the shortcuts keep quiet while typing', async ({ page }) => {
  await open(page, newServer());
  await page.keyboard.press('n');
  const box = page.getByRole('dialog').locator('textarea').first();
  await box.fill('');
  await box.pressSequentially('jkfb ghn');
  await expect(box).toHaveValue('jkfb ghn');
});

test('oldest first: u checks for new posts at the end, l loads older ones above', async ({ page }) => {
  const server = newServer();
  await open(page, server);
  const ids = () => page.locator('article[data-id]').evaluateAll((els) => els.map((e) => BigInt((e as HTMLElement).dataset.id!)));
  const [first, last] = [(await ids())[0], (await ids()).at(-1)!];

  // The window starts at the end of the timeline: nothing newer yet, then three new posts
  server.total = 203;
  await page.keyboard.press('u');
  await expect.poll(async () => (await ids()).at(-1)!).toBeGreaterThan(last);

  await page.keyboard.press('l');
  await expect.poll(async () => (await ids())[0]).toBeLessThan(first);
});

test('newest first: u loads the new posts above', async ({ page }) => {
  const server = newServer();
  server.total = 140;
  await open(page, server, 'newest-first');
  server.total = 143;
  await page.keyboard.press('u');
  await expect(page.locator(`article[data-id="${idOf(142)}"]`)).toHaveCount(1);
});

test('g then h and g then s go to a view, ? shows the shortcuts', async ({ page }) => {
  await open(page, newServer());
  await page.keyboard.press('g');
  await page.keyboard.press('s');
  await expect(page).toHaveURL(/#\/settings/);
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await expect(page).not.toHaveURL(/settings/);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a shortcut can be changed in the settings, and a taken key is refused', async ({ page }) => {
  const server = newServer();
  await open(page, server);
  await page.keyboard.press('g');
  await page.keyboard.press('s');
  const down = page.locator('[data-shortcut="down"]');
  await down.click();
  await page.keyboard.press('k'); // taken by "up"
  await expect(page.getByRole('alert').filter({ hasText: 'Up to the previous post on screen' })).toBeVisible();
  await expect(down).toContainText('j');

  await down.click();
  await page.keyboard.press('z');
  // A single key waits a moment for a second one
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ronsu-shortcuts')), { timeout: 4000 }).toBe('{"down":"z"}');

  await page.reload();
  await expect(page.locator('[data-shortcut="down"]')).toContainText('z');
  await page.getByRole('button', { name: 'Restore all defaults' }).click();
  await expect(page.locator('[data-shortcut="down"]')).toContainText('j');
});
