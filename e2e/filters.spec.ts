import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Page, server: Partial<Server>) {
  await mockMastodon(page, { marker: null, posts: [], ...server });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

// Post 196 matches the filter (196 % 6 === 4) and is on the first page; 195 does not
const FILTERED = idOf(196);
const PLAIN = idOf(195);

test('a warn filter covers the post with the filter title until it is shown', async ({ page }) => {
  await open(page, { filter: { title: 'Spoilers', action: 'warn' } });
  const card = page.locator(`article[data-id="${FILTERED}"]`);
  await expect(card.locator('.cw')).toContainText('Matches filter “Spoilers”');
  await expect(card.locator('.content')).toHaveCount(0);
  await expect(page.locator(`article[data-id="${PLAIN}"] .content`)).toBeVisible();

  await card.getByRole('button', { name: 'Show' }).click();
  await expect(card.locator('.content')).toBeVisible();
  await card.getByRole('button', { name: 'Hide' }).click();
  await expect(card.locator('.content')).toHaveCount(0);
});

test('a hide filter removes the post from the view', async ({ page }) => {
  await open(page, { filter: { title: 'Noise', action: 'hide' } });
  await expect(page.locator(`article[data-id="${PLAIN}"]`)).toBeVisible();
  await expect(page.locator(`article[data-id="${FILTERED}"]`)).toHaveCount(0);
});

test('a blur filter keeps the text and covers the pictures with the filter title', async ({ page }) => {
  await open(page, { filter: { title: 'Food', action: 'blur' } });
  const card = page.locator(`article[data-id="${idOf(198)}"]`); // matches and has a picture
  await expect(card.locator('.content')).toBeVisible();
  await expect(card.locator('.reveal')).toContainText('Matches filter “Food”');
  await card.locator('.reveal').click();
  await expect(card.locator('.reveal')).toHaveCount(0);
});

test('a filter that does not apply to this view is ignored', async ({ page }) => {
  await open(page, { filter: { title: 'Noise', action: 'hide', context: ['notifications'] } });
  await expect(page.locator(`article[data-id="${FILTERED}"]`)).toBeVisible();
});
