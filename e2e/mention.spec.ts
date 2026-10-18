import { expect, test, type Page } from '@playwright/test';
import { mockMastodon, seedAccount, type Server } from './mock';

async function openCompose(page: Page, server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.getByRole('button', { name: 'New post' }).first().click();
  return page.getByRole('dialog').first();
}

const newServer = (): Server => ({ marker: null, posts: [], created: [], attempts: [] });

test('typing @ offers accounts and the chosen one is inserted', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  const box = dialog.getByRole('textbox');
  await box.pressSequentially('Hello @ma');

  const list = dialog.getByRole('listbox', { name: 'Suggested accounts' });
  await expect(list.getByRole('option')).toHaveCount(2);
  expect(server.accountSearches).toEqual(['ma']);

  await box.press('ArrowDown');
  await box.press('Enter');
  await expect(list).toBeHidden();
  await expect(box).toHaveValue('Hello @matti@mastodon.example ');

  // The cursor is after the inserted handle: typing goes on from there
  await box.pressSequentially('hi');
  await expect(box).toHaveValue('Hello @matti@mastodon.example hi');
});

test('a suggestion can be tapped, and Esc closes the list without closing the form', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  const box = dialog.getByRole('textbox');
  await box.pressSequentially('@ma');
  await dialog.getByRole('option', { name: /Maija/ }).click();
  await expect(box).toHaveValue('@maija ');

  await box.pressSequentially('and @mat');
  await expect(dialog.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await box.press('Escape');
  await expect(dialog.getByRole('listbox')).toBeHidden();
  await expect(dialog).toBeVisible();
});

test('an e-mail address or a lone @ asks for nothing', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  const box = dialog.getByRole('textbox');
  await box.pressSequentially('write to me@mail and @ ');
  await page.waitForTimeout(500);
  expect(server.accountSearches ?? []).toEqual([]);
  await expect(dialog.getByRole('listbox')).toBeHidden();
});
