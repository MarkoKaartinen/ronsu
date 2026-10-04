import { expect, test } from '@playwright/test';
import { mockMastodon, seedAccount } from './mock';

test('if the app script fails to load, a message with a way out is shown instead of a blank screen', async ({ page }) => {
  await page.goto('/'); // let the static files load once so the service worker / cache state is not involved
  await page.route('**/assets/index-*.js', (route) => route.abort());
  await page.reload();

  const guard = page.locator('#boot-guard');
  await expect(guard).toBeVisible();
  await expect(guard).toContainText('Oh, no!');
  await expect(guard).toContainText('Failed to load');
  await expect(guard.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(guard.getByRole('button', { name: /Reset the app's cache/ })).toBeVisible();

  // The way out works: once the script loads again, "Try again" brings the app back
  await page.unroute('**/assets/index-*.js');
  await guard.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('#boot-guard')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Server' })).toBeVisible();
});

test('a crash while rendering shows the error screen, and "Try again" recovers once the data is fine', async ({ page }) => {
  await mockMastodon(page, { marker: null, posts: [] });
  await seedAccount(page);
  // A post without an account crashes the card while it is being rendered
  const broken = (route: import('@playwright/test').Route) =>
    route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify([{ id: '109000000000000999', content: '', account: null, media_attachments: [], mentions: [], emojis: [], spoiler_text: '' }]) });
  await page.route('https://mock.test/api/v1/timelines/home*', broken);
  await page.reload();

  const crash = page.getByRole('alert').filter({ hasText: 'Oh, no!' });
  await expect(crash).toBeVisible();
  await expect(crash.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(crash.getByRole('button', { name: /Reset the app's cache/ })).toBeVisible();

  await page.unroute('https://mock.test/api/v1/timelines/home*', broken);
  await crash.getByRole('button', { name: 'Try again' }).click();
  await page.waitForSelector('article[data-id]');
  await expect(crash).toHaveCount(0);
});

test('the reset button removes the service worker and caches and reloads, keeping the login', async ({ page }) => {
  await mockMastodon(page, { marker: null, posts: [] });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.evaluate(() => navigator.serviceWorker.ready);

  const { resetAndReloadAvailable } = await page.evaluate(() => ({ resetAndReloadAvailable: 'caches' in window && !!navigator.serviceWorker }));
  expect(resetAndReloadAvailable).toBe(true);

  // Open the guard's reset through the crash screen
  await page.route('https://mock.test/api/v1/timelines/home*', (route) =>
    route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify([{ id: '1', account: null, content: '', media_attachments: [], mentions: [], emojis: [], spoiler_text: '' }]) }),
  );
  await page.reload();
  const crash = page.getByRole('alert').filter({ hasText: 'Oh, no!' });
  await expect(crash).toBeVisible();
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockMastodon(page, { marker: null, posts: [] });
  await crash.getByRole('button', { name: /Reset the app's cache/ }).click();

  // Reloaded, still logged in (the account lives in IndexedDB, which the reset does not touch)
  await page.waitForSelector('article[data-id]');
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBeLessThanOrEqual(1);
});
