import { expect, test } from '@playwright/test';
import { mockMastodon, seedAccount, type Server } from './mock';

test('favorite, boost and bookmark update immediately and roll back on error', async ({ page }) => {
  const server: Server = { marker: null, posts: [], actions: [] };
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');

  const card = page.locator('article[data-id]').first();
  const fav = card.getByRole('button', { name: 'Favorite' });
  const boost = card.getByRole('button', { name: 'Boost' });
  const bookmark = card.getByRole('button', { name: 'Bookmark' });

  // Favorite: off -> on -> off, the counter follows
  await expect(fav).toHaveAttribute('aria-pressed', 'false');
  await fav.click();
  await expect(fav).toHaveAttribute('aria-pressed', 'true');
  await expect(fav).toContainText('1');
  await fav.click();
  await expect(fav).toHaveAttribute('aria-pressed', 'false');
  await expect(fav).toContainText('0');

  await boost.click();
  await expect(boost).toHaveAttribute('aria-pressed', 'true');
  await bookmark.click();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');

  await expect.poll(() => server.actions?.map((a) => a.split(':')[0])).toEqual(
    expect.arrayContaining(['favourite', 'unfavourite', 'reblog', 'bookmark']),
  );

  // Error: the state is restored and a notice is shown
  server.failActions = true;
  await fav.click();
  await expect(page.getByRole('alert')).toContainText('Something went wrong');
  await expect(fav).toHaveAttribute('aria-pressed', 'false');
  await expect(fav).toContainText('0');
});

test('the Quote button shows the count, opens the form and posts with quoted_status_id', async ({ page }) => {
  const server: Server = { marker: null, posts: [], created: [] };
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  const card = page.locator('article[data-id]').first();
  const id = await card.getAttribute('data-id');
  const quote = card.getByRole('button', { name: 'Quote' });
  await expect(quote).toContainText('1');
  await quote.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Quote' })).toBeVisible();
  await dialog.getByRole('textbox').fill('Worth reading');
  await dialog.getByRole('button', { name: 'Post' }).click();
  await expect.poll(() => server.created?.[0]?.body.quoted_status_id).toBe(id);
  expect(server.created![0].body.in_reply_to_id).toBeUndefined();
});
