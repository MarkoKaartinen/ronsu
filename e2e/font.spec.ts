import { expect, test, type Page } from '@playwright/test';
import { mockMastodon, seedAccount } from './mock';

async function open(page: Page) {
  await mockMastodon(page, { marker: null, posts: [] });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

const family = (page: Page) => page.evaluate(() => getComputedStyle(document.body).fontFamily);
const loaded = (page: Page, name: string) =>
  page.evaluate(async (n) => (await document.fonts.ready, [...document.fonts].some((f) => f.family === n && f.status === 'loaded')), name);

test('the default font is Figtree', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('data-font', 'figtree');
  expect(await family(page)).toContain('Figtree Variable');
});

test('a font can be chosen in the settings, applies at once and is remembered', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /^Account: @/ }).click();

  for (const [name, id, css] of [['Inter', 'inter', 'Inter Variable'], ['Open Sans', 'open-sans', 'Open Sans Variable'], ['JetBrains Mono', 'jetbrains-mono', 'JetBrains Mono Variable']] as const) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-font', id);
    expect(await family(page)).toContain(css);
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }

  // The font file of the chosen font really loads (it is a variable font with its own @font-face)
  await expect.poll(() => loaded(page, 'JetBrains Mono Variable')).toBe(true);

  // The system font needs no download and is named after the UI language
  const fontSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Font' }) });
  await fontSection.getByRole('button', { name: 'System', exact: true }).click();
  expect(await family(page)).not.toContain('Variable');

  await page.getByRole('button', { name: 'Open Sans', exact: true }).click();
  await page.reload();
  // The first paint already has the chosen font (set by the script before the app starts)
  await expect(page.locator('html')).toHaveAttribute('data-font', 'open-sans');
  expect(await family(page)).toContain('Open Sans Variable');
  expect(await page.evaluate(() => localStorage.getItem('font'))).toBe('open-sans');
});
