import { expect, test } from '@playwright/test';
import { mockMastodon, seedAccount } from './mock';

const theme = (page: import('@playwright/test').Page) => page.locator('html').getAttribute('data-theme');
const bg = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('the theme follows the system, the choice is saved and survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockMastodon(page, { marker: null, posts: [] });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  expect(await theme(page)).toBe('nord-dark');
  expect(await bg(page)).toBe('rgb(46, 52, 64)');

  // A system change updates the view on the fly
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => theme(page)).toBe('nord-light');
  expect(await bg(page)).toBe('rgb(236, 239, 244)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#eceff4');

  // The user's choice overrides the system and persists; the first paint already has the right theme
  await page.getByRole('button', { name: /^Account: @/ }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect.poll(() => theme(page)).toBe('nord-dark');
  await page.reload();
  expect(await theme(page)).toBe('nord-dark');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('theme-prefs')!).mode)).toBe('dark');
});

test('Dracula and Alucard can be chosen as the dark and the light theme, and are remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockMastodon(page, { marker: null, posts: [] });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');

  await page.getByRole('button', { name: /^Account: @/ }).click();
  await page.getByRole('group', { name: 'Dark theme' }).getByRole('button', { name: 'Dracula' }).click();
  await page.getByRole('group', { name: 'Light theme' }).getByRole('button', { name: 'Alucard' }).click();
  await expect(page.getByRole('button', { name: 'Dracula' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Nord Dark' })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => theme(page)).toBe('dracula-dark');
  expect(await bg(page)).toBe('rgb(40, 42, 54)');

  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect.poll(() => theme(page)).toBe('dracula-light');
  expect(await bg(page)).toBe('rgb(255, 251, 235)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#fffbeb');

  // The first paint after a reload already has the chosen theme
  await page.reload();
  expect(await theme(page)).toBe('dracula-light');
});
