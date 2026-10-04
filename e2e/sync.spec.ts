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

const fresh = (): Server => ({
  marker: { last_read_id: idOf(100), version: 3, updated_at: new Date(Date.now() - 60_000).toISOString() },
  posts: [],
});

for (const event of ['focus', 'pageshow', 'online']) {
  test(`the app notices another device's newer position when it wakes up (${event}), without a visibilitychange`, async ({ page }) => {
    const server = fresh();
    await open(page, server);
    await expect(banner(page)).toHaveCount(0);

    movedByAnotherDevice(server, 150);
    // An installed app resumed on a phone: no reload, and not every browser sends visibilitychange
    await page.evaluate((name) => window.dispatchEvent(name === 'pageshow' ? new PageTransitionEvent('pageshow') : new Event(name)), event);
    await expect(banner(page)).toBeVisible();

    // And the jump really goes to the other device's position
    await banner(page).getByRole('button', { name: 'Jump' }).click();
    await expect(page.locator(`article[data-id="${idOf(150)}"]`)).toBeVisible();
  });
}

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

test('our own position moved after the other device did: ours (the newer one) is kept, no banner', async ({ page }) => {
  const server = fresh();
  await open(page, server);
  movedByAnotherDevice(server, 120); // the other device was here first...
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
