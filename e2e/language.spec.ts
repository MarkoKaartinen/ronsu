import { expect, test, type Page } from '@playwright/test';
import { mockMastodon, seedAccount } from './mock';

async function open(page: Page) {
  await mockMastodon(page, { marker: null, posts: [] });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

test('the language follows the browser and defaults to English', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Load older' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New post' })).toBeVisible();
});

test.describe('Finnish browser', () => {
  test.use({ locale: 'fi-FI' });

  test('starts in Finnish with Mastodon\'s own terms', async ({ page }) => {
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fi');
    const card = page.locator('article[data-id]').first();
    // Mastodon's Finnish: boost = "tehosta", favorite = "suosikki", post = "julkaisu"
    await expect(card.getByRole('button', { name: 'Tehosta' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Suosikki' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Uusi julkaisu' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lataa vanhemmat' })).toBeVisible();
    // Short relative times as in Mastodon ("3 t", not "3 tuntia sitten")
    await expect(card.locator('a.time').first()).toHaveText(/^\d+ (min|t|pv)$|^nyt$/);
  });
});

test('the language is chosen in the settings, applies immediately and is remembered', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /^Account: @/ }).click();
  await page.getByRole('button', { name: 'Suomi', exact: true }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'fi');
  await expect(page.getByRole('region', { name: 'Tili ja asetukset' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kirjaudu ulos @me' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suomi', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('language'))).toBe('fi');

  // Survives a reload even though the browser language is English
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fi');
  await expect(page.getByRole('button', { name: 'Lataa vanhemmat' })).toBeVisible();

  // And back to English
  await page.getByRole('button', { name: /^Tili: @/ }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Log out @me' })).toBeVisible();
});
