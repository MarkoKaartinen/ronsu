import { expect, test, type Page } from '@playwright/test';
import { mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Page, server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

const openMenu = (page: Page) => page.locator('article[data-id]').first().getByRole('button', { name: 'More' }).click();

test('a post of someone else has no delete in the menu', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  await openMenu(page);
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
});

test('your own post is deleted after a confirmation and disappears', async ({ page }) => {
  const server: Server = { marker: null, posts: [], own: true };
  await open(page, server);
  const first = page.locator('article[data-id]').first();
  const id = await first.getAttribute('data-id');

  // Cancel: nothing happens
  await openMenu(page);
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete post?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(server.deleted).toBeUndefined();
  await expect(first).toBeVisible();

  await openMenu(page);
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator(`article[data-id="${id}"]`)).toHaveCount(0);
  expect(server.deleted).toEqual([id]);
});

test('a refused delete keeps the post and tells why', async ({ page }) => {
  await open(page, { marker: null, posts: [], own: true, failDelete: true });
  const id = await page.locator('article[data-id]').first().getAttribute('data-id');
  await openMenu(page);
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alert')).toContainText('Something went wrong');
  await expect(page.locator(`article[data-id="${id}"]`)).toBeVisible();
});

test('deleting the post of an open thread goes back', async ({ page }) => {
  const server: Server = { marker: null, posts: [], own: true };
  await open(page, server);
  const id = (await page.locator('article[data-id]').first().getAttribute('data-id'))!;
  await page.evaluate((i) => (location.hash = `/thread/${i}`), id);
  const focused = page.locator('article.focused');
  await expect(focused).toBeVisible();
  await focused.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page).not.toHaveURL(/thread/);
  expect(server.deleted).toEqual([id]);
});
