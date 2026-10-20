import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Page, server: Partial<Server>) {
  await mockMastodon(page, { marker: null, posts: [], ...server });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

// Post 197 has a preview (197 % 8 === 5) and no pictures; 189 has one too but also a picture (189 % 3 === 0)
test('a post with a link shows its preview: provider, title, description and picture, as a link', async ({ page }) => {
  await open(page, { cards: true });
  const preview = page.locator(`article[data-id="${idOf(197)}"] .preview`);
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Mock News');
  await expect(preview).toContainText('Story 197');
  await expect(preview).toContainText('About the story');
  await expect(preview).toHaveAttribute('href', 'https://mock.test/story/197');
  await expect(preview).toHaveAttribute('target', '_blank');
  await expect(preview).toHaveAttribute('rel', /noopener/);
  await expect(preview.locator('img')).toHaveAttribute('alt', 'A harbour');
  await expect(preview.locator('img')).toHaveAttribute('src', 'https://mock.test/img/card197.png');
});

test('opening the link does not open the thread', async ({ page }) => {
  await open(page, { cards: true });
  await page.route('https://mock.test/story/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>story</p>' }));
  const popup = page.waitForEvent('popup');
  await page.locator(`article[data-id="${idOf(197)}"] .preview`).click();
  await popup;
  await expect(page).not.toHaveURL(/#\/thread/);
});

test('a post with pictures has no preview', async ({ page }) => {
  await open(page, { cards: true });
  await expect(page.locator(`article[data-id="${idOf(189)}"] .media`)).toBeVisible();
  await expect(page.locator(`article[data-id="${idOf(189)}"] .preview`)).toHaveCount(0);
});

test('the picture of a preview stays out while the post is marked sensitive', async ({ page }) => {
  await open(page, { cards: true, sensitive: true });
  const preview = page.locator(`article[data-id="${idOf(197)}"] .preview`);
  await expect(preview).toContainText('Story 197');
  await expect(preview.locator('img')).toHaveCount(0);
});
