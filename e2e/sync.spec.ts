import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

const banner = (page: Page) => page.getByRole('status').filter({ hasText: 'You have read further on another device.' });

/** The server's marker as another device would leave it */
const movedByAnotherDevice = (server: Server, index: number) => {
  server.marker = { last_read_id: idOf(index), version: (server.marker?.version ?? 0) + 1, updated_at: new Date().toISOString() };
};

async function open(page: Page, server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.waitForTimeout(300);
}

/** The reader touches the screen (not a scroll made by the test itself) */
const touch = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('pointerdown')));

const notice = (page: Page) => page.getByRole('status').filter({ hasText: 'Continued from where you read on another device.' });

const fresh = (): Server => ({
  marker: { last_read_id: idOf(100), version: 3, updated_at: new Date(Date.now() - 60_000).toISOString() },
  posts: [],
});

for (const event of ['focus', 'pageshow', 'online']) {
  test(`an idle reader is taken to the other device's position when the app wakes up (${event}), without a visibilitychange`, async ({ page }) => {
    const server = fresh();
    await open(page, server);
    await expect(banner(page)).toHaveCount(0);

    movedByAnotherDevice(server, 150);
    // An installed app resumed on a phone: no reload, and not every browser sends visibilitychange
    await page.evaluate((name) => window.dispatchEvent(name === 'pageshow' ? new PageTransitionEvent('pageshow') : new Event(name)), event);
    // Nobody is touching the screen: no question, the feed just continues from the other device's place
    await expect(notice(page)).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
    await expect(page.locator(`article[data-id]`).first()).toHaveAttribute('data-id', idOf(150));
  });
}

test('the automatic jump can be undone, and the old place becomes the position again', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  movedByAnotherDevice(server, 150);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(notice(page)).toBeVisible();
  await notice(page).getByRole('button', { name: 'Undo' }).click();
  await expect(notice(page)).toHaveCount(0);
  await expect(page.locator('article[data-id]').first()).toHaveAttribute('data-id', idOf(100));
  await expect.poll(() => server.marker?.last_read_id).toBe(idOf(100));
});

test('a reader who is touching the screen is asked instead of being moved', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  await touch(page);
  movedByAnotherDevice(server, 150);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(banner(page)).toBeVisible();
  await banner(page).getByRole('button', { name: 'Jump' }).click();
  await expect(page.locator(`article[data-id="${idOf(150)}"]`)).toBeVisible();
});

test('the first touch after a long break looks at the server, even if no wake-up event came', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  // The page has been frozen for a while: the last look at the server was long ago
  await page.clock.install();
  await page.clock.fastForward(60_000);
  movedByAnotherDevice(server, 150);
  await touch(page);
  await expect(notice(page)).toBeVisible();
});

test('the sync icon tells whether the position has reached the server', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  await expect(page.getByRole('img', { name: 'Reading position saved' })).toBeVisible();
  for (let y = 1500; y <= 4000; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await expect(page.getByRole('img', { name: 'Reading position not sent yet' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Reading position saved' })).toBeVisible({ timeout: 6000 });
});

test('a phone whose clock is ahead still notices the other device (the server counts versions, clocks are not trusted)', async ({ page }) => {
  // The phone's clock is 10 minutes ahead of the server's
  await page.addInitScript(() => {
    const real = Date.now.bind(Date);
    Date.now = () => real() + 10 * 60 * 1000;
  });
  const server = fresh();
  await open(page, server);

  // The phone reads on and sends its position (the wake-up flushes it at once instead of after the throttle)
  for (let y = 1500; y <= 4000; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => server.posts.length).toBeGreaterThan(0);
  await expect(banner(page)).toHaveCount(0); // our own save is not "another device"

  // The desktop reads further; the server's time stamp is 10 minutes *behind* the phone's clock
  await touch(page); // reading right now: asked, not moved
  movedByAnotherDevice(server, 190);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(banner(page)).toBeVisible();
});

test('a position that has not been sent yet is sent when the app wakes up, not after the throttle', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  for (let y = 1500; y <= 4000; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
  expect(server.posts).toHaveLength(0); // still waiting for the throttle

  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => server.posts.length, { timeout: 2000 }).toBeGreaterThan(0);
});

test('our own position is further than the other device\'s: ours is kept, no banner', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  movedByAnotherDevice(server, 102); // the other device was here first...
  await page.waitForTimeout(1100);
  for (let y = 1500; y <= 4000; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y); // ...then we read further, unsent
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => server.posts.length).toBeGreaterThan(0); // ours wins: it is sent to the server
  await expect(banner(page)).toHaveCount(0);
});

test('opening the app where another device has read further says so', async ({ page }) => {
  const server = fresh();
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('read-marker')).forEach((k) => localStorage.removeItem(k)));
  movedByAnotherDevice(server, 150);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  const note = page.getByRole('status').filter({ hasText: 'Continuing from where you read on another device.' });
  await expect(note).toBeVisible();
  await note.getByRole('button', { name: 'OK' }).click();
  await expect(note).toHaveCount(0);
});

test('the notice is in the sticky bar: it stays in view after scrolling', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  for (let y = 1500; y <= 4000; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); // our position is sent first
  await expect.poll(() => server.posts.length).toBeGreaterThan(0);
  await touch(page);
  movedByAnotherDevice(server, 190);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(banner(page)).toBeInViewport();
});

test('newest first: "You left off here" is at the top of the screen under the bar, with the read posts below it', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  await page.getByLabel('Reading order').selectOption('newest-first');
  await page.reload(); // a refresh must not move the place either
  const divider = page.locator('.divider[data-restored]');
  await expect(divider).toBeVisible();
  await page.waitForTimeout(300);
  const [d, bar] = await Promise.all([divider.boundingBox(), page.locator('.bar:has(.row)').boundingBox()]);
  expect(Math.abs(d!.y - (bar!.y + bar!.height))).toBeLessThan(4);
});

test('loading more posts first checks the other device: if it has moved on, the question is asked and nothing is loaded', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  await page.waitForTimeout(2200); // the last look at the server is no longer fresh
  const before = await page.locator('article[data-id]').count();
  movedByAnotherDevice(server, 150);
  await page.getByRole('button', { name: 'Load older' }).click();
  await expect(banner(page)).toBeVisible();
  expect(await page.locator('article[data-id]').count()).toBe(before);

  // Ignoring the question does not block loading
  await banner(page).getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Load older' }).click();
  await expect.poll(() => page.locator('article[data-id]').count()).toBeGreaterThan(before);
});

test('scrolling back up never moves the position back: an older post is not sent to the server', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  for (let y = 1500; y <= 4000; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => server.posts.length).toBeGreaterThan(0);
  const furthest = server.marker?.last_read_id as string;
  expect(BigInt(furthest)).toBeGreaterThan(BigInt(idOf(100)));

  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1500);
  expect(server.marker?.last_read_id).toBe(furthest);
});

for (const order of ['oldest-first', 'newest-first']) {
  test(`${order}: reading on from an old place never overwrites a position another device has read further (the question is asked)`, async ({ page }) => {
    const server = fresh();
    await open(page, server);
    await page.getByLabel('Reading order').selectOption(order);
    await page.reload();
    await page.waitForSelector('article[data-id]');
    await page.waitForTimeout(300);

    // The other device reads on while this one sits in the background: no wake-up event, so nothing noticed yet
    movedByAnotherDevice(server, 150);
    const other = server.marker?.last_read_id;
    // Reading on: down the list (oldest first), or up from the divider (newest first), in steps smaller than the screen
    const from = await page.evaluate(() => window.scrollY);
    const ys = order === 'oldest-first' ? [1500, 2000, 2500, 3000, 3500, 4000] : Array.from({ length: 12 }, (_, i) => Math.max(0, from - 300 * (i + 1)));
    for (const y of ys) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(4500); // longer than the send throttle
    expect(server.marker?.last_read_id).toBe(other);
    await expect(banner(page)).toBeVisible();
  });
}

test('leaving the app while the question about the other device is open never overwrites its position', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  await touch(page);
  movedByAnotherDevice(server, 150);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(banner(page)).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(500);
  expect(server.posts).toHaveLength(0);
  expect(server.marker?.last_read_id).toBe(idOf(150));
});

test('leaving the app without having read anything sends nothing', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  movedByAnotherDevice(server, 150); // moved after we looked, not noticed yet
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(500);
  expect(server.posts).toHaveLength(0);
});

test('a local position that is behind the server\'s is not sent when the app is left at once, even if its clock is ahead', async ({ page }) => {
  const server = fresh();
  await mockMastodon(page, server);
  await seedAccount(page);
  // Left from an earlier visit, stamped by a clock that is ahead of the server's
  await page.evaluate(
    (id) => {
      Object.keys(localStorage).filter((k) => k.startsWith('read-marker')).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem('read-marker|mock.test|1', JSON.stringify({ id, at: Date.now() + 3_600_000 }));
    },
    idOf(50),
  );
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(500);
  expect(server.posts).toHaveLength(0);
  expect(server.marker?.last_read_id).toBe(idOf(100));
  await expect(page.locator('article[data-id]').first()).toHaveAttribute('data-id', idOf(100));
});
