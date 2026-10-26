import { expect, test } from '@playwright/test';
import { idOf, mockMastodon, seedAccount } from './mock';

test('the timestamp links to the original post and there is no external-link icon', async ({ page }) => {
  await mockMastodon(page, { marker: null, posts: [] });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');

  const card = page.locator(`article[data-id="${idOf(190)}"]`);
  const time = card.locator('a.time');
  await expect(time).toHaveAttribute('href', 'https://mock.test/s/190');
  await expect(time).toHaveAttribute('target', '_blank');
  await expect(card.locator('a.ext')).toHaveCount(0);

  // Tapping the timestamp does not open the thread in the app
  await time.evaluate((el: HTMLElement) => el.addEventListener('click', (e) => e.preventDefault()));
  await time.evaluate((el: HTMLElement) => el.click());
  await expect(page).not.toHaveURL(/#\/thread/);
});

test('an edited post has a mark with the time of the edit, a post that was not edited has none', async ({ page }) => {
  await mockMastodon(page, { marker: null, posts: [] });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await expect(page.locator('.edited')).toHaveCount(0);

  await mockMastodon(page, { marker: null, posts: [], edited: true });
  await page.reload();
  await page.waitForSelector('article[data-id]');
  const mark = page.locator(`article[data-id="${idOf(190)}"] .edited`);
  await expect(mark).toHaveAttribute('title', /^Edited /);

  // The selected post of a thread says it in words
  await page.evaluate((i) => (location.hash = `/thread/${i}`), idOf(190));
  await expect(page.locator('article.focused')).toContainText('Edited');
});
