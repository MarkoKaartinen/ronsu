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
  await expect(mark).toHaveAttribute('title', /^Last edited /);

  // The selected post of a thread says it in words
  await page.evaluate((i) => (location.hash = `/thread/${i}`), idOf(190));
  await expect(page.locator('article.focused')).toContainText('Last edited');
});

test('the mark of an edited post opens the version history, the newest version first', async ({ page }) => {
  await mockMastodon(page, { marker: null, posts: [], edited: true });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.locator(`article[data-id="${idOf(190)}"] .edited`).click();

  const dialog = page.getByRole('dialog', { name: 'Version history' });
  await expect(dialog).toBeVisible();
  await expect(page).not.toHaveURL(/#\/thread/); // the card behind it did not open
  const versions = dialog.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3 }) });
  await expect(versions.nth(0).getByRole('heading')).toContainText('U edited');
  await expect(versions.nth(0)).toContainText('Version 2');
  await expect(versions.nth(0)).toContainText('Tea');
  await expect(versions.nth(1)).toContainText('food talk');
  await expect(versions.nth(1).getByRole('img', { name: 'a picture' })).toBeVisible();
  await expect(versions.nth(2).getByRole('heading')).toContainText('U created');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  // The selected post of a thread has it as a line of text
  await page.evaluate((i) => (location.hash = `/thread/${i}`), idOf(190));
  await page.locator('article.focused').getByRole('button', { name: /Last edited/ }).click();
  await expect(dialog).toBeVisible();
});

test('a history that cannot be fetched says so', async ({ page }) => {
  await mockMastodon(page, { marker: null, posts: [], edited: true, failHistory: true });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.locator(`article[data-id="${idOf(190)}"] .edited`).click();
  await expect(page.getByRole('dialog', { name: 'Version history' }).getByRole('alert')).toContainText('Something went wrong');
});
