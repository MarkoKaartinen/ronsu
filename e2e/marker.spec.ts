import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, toEnd, type Server } from './mock';

const topArticle = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('.bar')!.getBoundingClientRect().bottom;
    for (const el of document.querySelectorAll<HTMLElement>('article[data-id]')) {
      const r = el.getBoundingClientRect();
      if (r.bottom - bar >= 48) return { id: el.dataset.id!, top: r.top - bar };
    }
    return null;
  });

async function open(page: Page, server: Server) {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  return logs;
}

test('the reading position is saved locally and restored after a reload', async ({ page }) => {
  const server: Server = { marker: null, posts: [] };
  const logs = await open(page, server);

  for (let y = 1500; y <= 6000; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(400);
  const seen = await topArticle(page);
  const stored = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('read-marker'))),
  );
  console.log('top:', seen, 'stored:', stored, 'logs:', logs);
  expect(Object.keys(stored).length).toBeGreaterThan(0);

  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.waitForTimeout(500);
  const first = await page.evaluate(() => document.querySelector<HTMLElement>('article[data-id]')!.dataset.id);
  console.log('first article after reload:', first, 'divider:', await page.locator('.divider').allTextContents());
  expect(first).toBe(seen!.id);
});

test('Load older does not move the screen', async ({ page }) => {
  const server: Server = { marker: { last_read_id: '109000000000000100', version: 1, updated_at: '2026-10-04T05:00:00.000Z' }, posts: [] };
  await open(page, server);
  await page.waitForTimeout(300);
  // Repeat the loads: the last one brings the oldest and removes the button (the height changes)
  let n = await page.locator('article[data-id]').count();
  for (let round = 0; round < 6; round++) {
    const btn = page.getByRole('button', { name: 'Load older' });
    if (!(await btn.count())) break;
    const anchorId = await page.evaluate(() => document.querySelector<HTMLElement>('article[data-id]')!.dataset.id);
    const top = (id: string | undefined) =>
      page.evaluate((i) => document.querySelector(`article[data-id="${i}"]`)!.getBoundingClientRect().top, id);
    const before = await top(anchorId);
    await btn.evaluate((el: HTMLElement) => el.click()); // no automatic scrolling by Playwright
    await page.waitForFunction((c) => document.querySelectorAll('article[data-id]').length > c, n, { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(2000); // let the lazy images load
    n = await page.locator('article[data-id]').count();
    const after = await top(anchorId);
    console.log(`round ${round}: before ${before}, after ${after}, articles ${n}`);
    expect(Math.abs(after - before)).toBeLessThan(2);
  }
  expect(await page.getByRole('button', { name: 'Load older' }).count()).toBe(0);
});

test('"Load new" at the end: new posts arrive and the caught-up message with its button comes back every time', async ({ page }) => {
  // The reading position is near the end, so the feed has only a short last page
  const server: Server = { marker: { last_read_id: '109000000000000195', version: 1, updated_at: '2026-10-04T05:00:00.000Z' }, posts: [], total: 200 };
  await open(page, server);
  const caughtUp = page.getByText('You are all caught up.');
  const check = page.getByRole('button', { name: 'Load new' });
  const toBottom = () => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await toEnd(page);
  await expect(caughtUp).toBeVisible();
  await expect(check).toBeVisible();

  // Each round: new posts arrive on the server, the reader (at the bottom, where the button is) presses the
  // button. Nothing may be left empty at the bottom: the message and the button are back, so the next round works.
  let total = 200;
  for (const arrived of [1, 2, 3, 1]) {
    total += arrived;
    server.total = total;
    await toBottom();
    await check.click();
    await expect(page.locator(`article[data-id="${idOf(total - 1)}"]`)).toHaveCount(1);
    await toEnd(page); // the new posts are read: the reader goes on to the end (and presses "Load more" if it is there)
    await expect(caughtUp).toBeVisible({ timeout: 5000 });
    await expect(check).toBeVisible();
  }

  // And when nothing new has arrived, pressing the button leaves the message and the button as they were
  await toBottom();
  await check.click();
  await expect(caughtUp).toBeVisible();
  await expect(check).toBeVisible();
});

test('a single new post: once it is read the message and the button are back', async ({ page }) => {
  const server: Server = { marker: { last_read_id: '109000000000000195', version: 1, updated_at: '2026-10-04T05:00:00.000Z' }, posts: [], total: 200 };
  await open(page, server);
  await toEnd(page);
  await expect(page.getByText('You are all caught up.')).toBeVisible();

  server.total = 201;
  await page.getByRole('button', { name: 'Load new' }).click();
  await expect(page.locator(`article[data-id="${idOf(200)}"]`)).toHaveCount(1);
  // Nothing is fetched by scrolling: the reader goes to the end, and the next page (empty) is asked for with the button
  await toEnd(page);
  await expect(page.getByText('You are all caught up.')).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Load new' })).toBeVisible();
});

test('the strip tells how far behind the reading position is: it falls steadily while reading, never jumps when the next page loads, and ends at "up to date"', async ({ page }) => {
  // The reading position is post 10 of 200; the posts are a minute apart, so the newest is 189 minutes (3h) ahead
  const server: Server = { marker: { last_read_id: '109000000000000010', version: 1, updated_at: '2026-10-04T05:00:00.000Z' }, posts: [], total: 200 };
  await page.setViewportSize({ width: 420, height: 800 });
  await open(page, server);
  const status = page.locator('.bar .status');
  await expect(status).toHaveText('You are 3h behind');

  const minutes = async () => {
    const text = (await status.innerText()).trim();
    if (/up to date/.test(text)) return 0;
    const [, n, unit] = /(\d+)([mhd])/.exec(text)!;
    return Number(n) * { m: 1, h: 60, d: 1440 }[unit as 'm' | 'h' | 'd'];
  };

  // Scroll on through several pages (each page load used to make the old unread count jump back up)
  let previous = await minutes();
  const seen = new Set<number>([previous]);
  for (let y = 700; y <= 30000; y += 700) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    // The next page comes with the button, when the reader has reached the end of what is loaded
    const more = page.getByRole('button', { name: 'Load more' });
    if (await more.isVisible()) await more.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(150);
    const now = await minutes();
    expect(now, `at ${y}px`).toBeLessThanOrEqual(previous);
    previous = now;
    seen.add(now);
  }
  expect(seen.size).toBeGreaterThanOrEqual(3); // it really changes as the reading moves on (3h, 2h, 1h, ...)

  // At the very end there is nothing behind (the reader goes on to the bottom of each page until the feed ends)
  await toEnd(page);
  await expect(page.getByText('You are all caught up.')).toBeVisible();
  await expect(status).toHaveText('You are up to date');

  // A hint that a few new posts have arrived: the position is behind again, by the time of the new posts
  server.total = 215;
  await page.getByRole('button', { name: 'Load new' }).click();
  await expect.poll(minutes).toBeGreaterThan(0);
});

test('"Load new" does not move the view: the new posts appear below, and nothing is skipped or marked read', async ({ page }) => {
  const server: Server = { marker: { last_read_id: '109000000000000190', version: 1, updated_at: '2026-10-04T05:00:00.000Z' }, posts: [], total: 200 };
  await page.setViewportSize({ width: 420, height: 800 });
  await open(page, server);
  await toEnd(page);
  await expect(page.getByText('You are all caught up.')).toBeVisible();
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => Math.round(scrollY));
  const topBefore = await topArticle(page);

  server.total = 215; // fifteen new posts, far more than fit on a screen
  await page.getByRole('button', { name: 'Load new' }).evaluate((el: HTMLElement) => el.click()); // no automatic scrolling by Playwright
  await expect(page.locator(`article[data-id="${idOf(214)}"]`)).toHaveCount(1);
  await page.waitForTimeout(500);

  // The browser's scroll anchoring would have followed the bottom of the page and jumped to the end of the new posts
  expect(Math.abs((await page.evaluate(() => Math.round(scrollY))) - before)).toBeLessThan(3);
  expect((await topArticle(page))!.id).toBe(topBefore!.id);
  // The strip says how far behind the reader now is (the new posts are ahead), not "up to date"
  await expect(page.locator('.bar .status')).toContainText('behind');
});
