import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

const server0 = (): Server => ({ marker: { last_read_id: idOf(100), version: 1, updated_at: '2026-10-04T05:00:00.000Z' }, posts: [], total: 200 });

async function open(page: Page, server: Server, order?: 'newest-first') {
  if (order) await page.addInitScript((o) => localStorage.setItem('reading-order', o), order);
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.waitForTimeout(300);
}

const top = (page: Page, id: string) =>
  page.evaluate((i) => document.querySelector(`article[data-id="${i}"]`)!.getBoundingClientRect().top, id);

test('newest first: "Load new" puts the new posts above and the post being read does not move', async ({ page }) => {
  const server = server0();
  server.total = 140; // nothing newer than post 139
  await open(page, server, 'newest-first');
  const anchor = await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('article[data-id]')) {
      if (el.getBoundingClientRect().top > 60) return el.dataset.id!;
    }
    return '';
  });
  const before = await top(page, anchor);

  // Nothing new yet: a short note, nothing changes
  const btn = page.getByRole('button', { name: 'Load new' });
  await btn.evaluate((el: HTMLElement) => el.click());
  await expect(page.getByText('No new posts.')).toBeVisible();

  server.total = 143;
  await btn.evaluate((el: HTMLElement) => el.click());
  await expect(page.locator(`article[data-id="${idOf(142)}"]`)).toHaveCount(1);
  await page.waitForTimeout(1500); // let the pictures load
  const ids = await page.locator('article[data-id]').evaluateAll((els) => els.slice(0, 4).map((e) => (e as HTMLElement).dataset.id));
  expect(ids).toEqual([idOf(142), idOf(141), idOf(140), idOf(139)]); // gapless, newest first
  expect(Math.abs((await top(page, anchor)) - before)).toBeLessThan(2);
});

test('oldest first: loading more also sends the reading position, without waiting for the throttle', async ({ page }) => {
  const server = server0();
  await open(page, server);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(300); // the position moved; the throttle (5 s) has not fired
  expect(server.posts).toHaveLength(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); // the next page is asked for
  await expect.poll(() => server.posts.length, { timeout: 3000 }).toBeGreaterThan(0);
});

test('a position that never reached the server (dropped request) is sent again when the app is resumed', async ({ page }) => {
  const server = server0();
  await open(page, server);
  let dropped = 0;
  await page.route('https://mock.test/api/v1/markers', async (route) => {
    if (route.request().method() === 'POST' && dropped === 0) {
      dropped++;
      return route.abort('failed'); // what a frozen phone page does to the request
    }
    return route.fallback();
  });
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); // flush(true): dropped
  await expect.poll(() => dropped).toBe(1);
  expect(server.posts).toHaveLength(0);

  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); // resume
  await expect.poll(() => server.posts.length, { timeout: 2000 }).toBeGreaterThan(0);
});

const scrollThrough = async (page: Page, from: number, to: number, step: number) => {
  for (let y = from; step > 0 ? y <= to : y >= to; y += step) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(70);
  }
};
const marker180 = (): Server => ({ marker: { last_read_id: idOf(180), version: 1, updated_at: '2026-10-04T05:00:00.000Z' }, posts: [], total: 200 });
const divider = (page: Page) => page.locator('.divider');
const lastPost = (server: Server) => BigInt(server.posts[server.posts.length - 1] ?? '0') - 109000000000000000n;

test('newest first, reading upwards from the divider: the position follows and is saved', async ({ page }) => {
  const server = marker180();
  await open(page, server, 'newest-first');
  await divider(page).scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => window.scrollY);
  await scrollThrough(page, y, 0, -250); // up to the newest
  await expect.poll(() => lastPost(server), { timeout: 8000 }).toBeGreaterThan(185n);
  // The divider stays where the session started: it does not walk away under the reader
  await expect(divider(page)).toHaveCount(1);
});

test('newest first opens at the divider, with the newer posts above it and the older ones below', async ({ page }) => {
  const server = marker180();
  await open(page, server, 'newest-first');
  const box = await divider(page).boundingBox();
  const vh = page.viewportSize()!.height;
  expect(box!.y).toBeGreaterThan(0);
  expect(box!.y).toBeLessThan(vh);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const order = await page.locator('article[data-id]').evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.id!.slice(-3))));
  expect(order.slice(0, 3)).toEqual([199, 198, 197]);
  expect(order).toContain(180);
  expect(order).toContain(179); // older posts continue below
});

for (const [from, to] of [['oldest-first', 'newest-first'], ['newest-first', 'oldest-first']] as const) {
  test(`switching from ${from} to ${to} with slow requests does not load the same posts twice (no each_key_duplicate crash)`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const server = marker180();
    await open(page, server, from);
    // Slow requests: while the list is empty and being rebuilt the infinite scroll is in view and asks for a page
    // of its own, which must not end up in the list a second time
    await page.route(/\/api\/v1\/(statuses\/\d+|timelines\/home)/, async (route) => {
      const slow = route.request().url().includes('timelines/home') && !route.request().url().includes('min_id');
      await new Promise((r) => setTimeout(r, slow ? 1200 : 150));
      return route.fallback();
    });
    await page.locator('.order select').selectOption(to);
    await page.waitForTimeout(3000);
    const ids = await page.locator('article[data-id]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(errors).toEqual([]);
  });
}

test('newest first also tells how far behind you are, and it falls as you read upwards', async ({ page }) => {
  const server = marker180(); // the posts are a minute apart: the newest (199) is 19 minutes ahead
  await open(page, server, 'newest-first');
  const status = page.locator('.bar .status');
  await expect(status).toContainText('behind');
  const y = await page.evaluate(() => window.scrollY);
  await scrollThrough(page, y, 0, -250);
  await expect(status).toHaveText(/up to date|behind/);
  await expect.poll(async () => (await status.innerText()).trim(), { timeout: 8000 }).toMatch(/up to date|[0-4]m behind/);
});

/** The remembered post ("You left off here") and the posts newer than it, as they are in the list, top to bottom */
async function unread(page: Page) {
  const restored = await page.locator('.divider[data-restored] + article').getAttribute('data-id');
  const ids = await page.locator('article[data-id]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id!));
  return { restored: restored!, newer: ids.filter((id) => BigInt(id) > BigInt(restored!)), all: ids };
}

/** Reading forwards the button is at the very end (once everything is loaded): scroll there and wait for it */
async function reachEnd(page: Page, order: 'oldest-first' | 'newest-first') {
  if (order === 'newest-first') return;
  await expect
    .poll(async () => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      return page.getByText('You are all caught up.').count();
    }, { timeout: 8000 })
    .toBe(1);
}

for (const start of ['oldest-first', 'newest-first'] as const) {
  test(`"Load new" works from ${start}, and after switching the direction the same posts are unread (in the opposite order)`, async ({ page }) => {
    const server: Server = { marker: { last_read_id: idOf(195), version: 1, updated_at: '2026-10-04T05:00:00.000Z' }, posts: [], total: 200 };
    const other = start === 'oldest-first' ? 'newest-first' : 'oldest-first';
    await open(page, server, start);
    const mine = await unread(page);
    const expected4 = [196, 197, 198, 199].map(idOf);
    expect(mine.newer).toEqual(start === 'oldest-first' ? expected4 : [...expected4].reverse());

    // Three new posts arrive; the button brings them (below the list when reading forwards, above it otherwise)
    await reachEnd(page, start);
    server.total = 203;
    const btn = page.getByRole('button', { name: 'Load new' });
    await expect(btn).toBeVisible();
    await btn.evaluate((el: HTMLElement) => el.click());
    await expect(page.locator(`article[data-id="${idOf(202)}"]`)).toHaveCount(1);
    const loaded = await unread(page);
    const expected = [196, 197, 198, 199, 200, 201, 202].map(idOf);
    expect(loaded.newer).toEqual(start === 'oldest-first' ? expected : [...expected].reverse());
    expect(new Set(loaded.all).size).toBe(loaded.all.length);

    // Switch: the list is rebuilt from the saved position, with the same unread posts the other way round
    await page.locator('.order select').selectOption(other);
    await expect(page.locator('.divider[data-restored]')).toHaveCount(1);
    await page.waitForTimeout(500);
    const switched = await unread(page);
    expect(new Set(switched.all).size).toBe(switched.all.length);
    const marker = BigInt(switched.restored);
    expect(marker >= BigInt(idOf(195))).toBe(true);
    // Whatever position the reader had reached, every post after it is there exactly once, in the right order
    const want: string[] = [];
    for (let n = marker + 1n; n <= BigInt(idOf(202)); n++) want.push(n.toString());
    expect(switched.newer).toEqual(other === 'oldest-first' ? want : [...want].reverse());

    // And "Load new" still works from here
    await reachEnd(page, other);
    server.total = 205;
    await expect(btn).toBeVisible();
    await btn.evaluate((el: HTMLElement) => el.click());
    await expect(page.locator(`article[data-id="${idOf(204)}"]`)).toHaveCount(1);
    const after = await unread(page);
    expect(new Set(after.all).size).toBe(after.all.length);
    expect(after.newer.length).toBe(Number(BigInt(idOf(204)) - BigInt(after.restored)));
  });
}
