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

test('the emoji picker offers custom and Unicode emoji and puts them at the cursor', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  const box = dialog.getByRole('textbox', { name: "What's on your mind?" });
  await box.fill('Hello');

  await dialog.getByRole('button', { name: 'Insert emoji' }).click();
  const picker = dialog.getByRole('group', { name: 'Insert emoji' });
  const headings = picker.getByRole('heading');
  // The custom emoji come first, the Unicode ones by group; the one the server hides is not offered
  await expect(headings.nth(2)).toHaveText('Smileys & emotion');
  expect(await headings.allTextContents()).toEqual(expect.arrayContaining(['Custom', 'Fun', 'Flags']));
  expect((await headings.allTextContents()).slice(0, 2)).toEqual(['Custom', 'Fun']);
  await expect(picker.getByRole('button', { name: ':secret:' })).toHaveCount(0);

  await picker.getByRole('button', { name: ':party:' }).click();
  await expect(box).toHaveValue('Hello :party: ');

  // The picker stays open for the next one, and the search narrows the list (names and tags of Unicode emoji too)
  await picker.getByRole('searchbox').fill('grinning face');
  await picker.getByRole('button', { name: 'grinning face', exact: true }).click();
  await expect(box).toHaveValue('Hello :party: 😀');

  // Esc closes the picker only
  await picker.getByRole('searchbox').press('Escape');
  await expect(picker).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(box).toBeFocused();

  // What was used is offered first the next time, and the custom emoji are fetched once per server
  await dialog.getByRole('button', { name: 'Insert emoji' }).click();
  await expect(headings.first()).toHaveText('Frequently used');
  await expect(picker.getByRole('button', { name: /^(:party:|grinning face)$/ })).toHaveCount(4); // also in their own groups
  expect(server.emojiRequests).toBe(1);

  // Nothing matches
  await picker.getByRole('searchbox').fill('zzzzzz');
  await expect(picker.getByText('No matching emojis found')).toBeVisible();
});
