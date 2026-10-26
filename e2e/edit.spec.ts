import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Page, server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

const server = (over: Partial<Server> = {}): Server => ({ marker: null, posts: [], own: true, ...over });

/** Opens the edit form of a post (one with pictures: every third) */
async function startEdit(page: Page, n = 162) {
  const card = page.locator(`article[data-id="${idOf(n)}"]`);
  await card.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit post' });
  await expect(dialog).toBeVisible();
  return { card, dialog, text: dialog.getByRole('textbox', { name: /on your mind/ }), save: dialog.getByRole('button', { name: 'Save changes' }) };
}

test('a post of someone else has no edit in the menu', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  await page.locator('article[data-id]').first().getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toHaveCount(0);
});

test('the text comes from the server as it was written, and saving sends the whole post and updates the card', async ({ page }) => {
  const s = server();
  await open(page, s);
  const { card, dialog, text, save } = await startEdit(page);

  await expect(text).toHaveValue('The text as written');
  await expect(save).toBeDisabled(); // nothing is changed yet
  await expect(dialog.getByRole('combobox', { name: 'Visibility' })).toBeDisabled(); // the visibility stays what it was
  await text.fill('The text as corrected');
  await save.click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('alert').filter({ hasText: 'Post saved.' })).toBeVisible();
  expect(s.edits).toHaveLength(1);
  expect(s.edits![0].id).toBe(idOf(162));
  expect(s.edits![0].body).toMatchObject({
    status: 'The text as corrected', visibility: 'public', spoiler_text: '', sensitive: false,
    media_ids: ['m162_0'], media_attributes: [], poll: null,
  });
  await expect(card).toContainText('The text as corrected');
});

test('a content warning comes with the text and can be taken off', async ({ page }) => {
  const s = server({ sourceCw: 'food talk' });
  await open(page, s);
  const { dialog, text, save } = await startEdit(page);
  await expect(dialog.getByPlaceholder('Content warning')).toHaveValue('food talk');
  await dialog.getByRole('button', { name: 'Content warning' }).click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(dialog).toBeHidden();
  expect(s.edits![0].body).toMatchObject({ status: 'The text as written', spoiler_text: '' });
});

test('a picture already in the post is described and removed with the post, not with the media endpoint', async ({ page }) => {
  const s = server();
  await open(page, s);
  const { dialog, save } = await startEdit(page);

  await dialog.getByRole('button', { name: 'Edit', exact: true }).click();
  const alt = page.getByRole('dialog', { name: 'Add alt text' });
  await alt.getByRole('textbox').fill('A better description');
  await alt.getByRole('button', { name: 'Done' }).click();
  await save.click();
  await expect(dialog).toBeHidden();
  expect(s.descriptions).toBeUndefined(); // PUT /media/:id was not used
  expect(s.edits![0].body).toMatchObject({ media_ids: ['m162_0'], media_attributes: [{ id: 'm162_0', description: 'A better description' }] });

  const again = await startEdit(page);
  await again.dialog.getByRole('button', { name: 'Remove' }).click();
  await again.save.click();
  await expect(again.dialog).toBeHidden();
  expect(s.edits![1].body).toMatchObject({ media_ids: [] });
});

test('the poll of the post is in the form and goes back with it', async ({ page }) => {
  const s = server({ poll: { own: true } });
  await open(page, s);
  const { dialog, text, save } = await startEdit(page);
  await expect(dialog.getByLabel('Option 1')).toHaveValue('Tea');
  await expect(dialog.getByLabel('Option 3')).toHaveValue('Water');
  await text.fill('Which one, really?');
  await save.click();
  await expect(dialog).toBeHidden();
  expect(s.edits![0].body.poll).toEqual({ options: ['Tea', 'Coffee', 'Water'], expires_in: 604_800, multiple: false });

  // Taking the poll off sends null
  const again = await startEdit(page);
  await again.dialog.getByRole('button', { name: 'Remove poll' }).click();
  await again.save.click();
  await expect(again.dialog).toBeHidden();
  expect(s.edits![1].body.poll).toBeNull();
});

test('a form that is changed asks before it is closed, one that is not does not', async ({ page }) => {
  await open(page, server());
  const { dialog, text } = await startEdit(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();

  const again = await startEdit(page);
  page.once('dialog', (d) => d.dismiss());
  await again.text.fill('Something else');
  await again.dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(again.dialog).toBeVisible();
});

test('a refused edit stays in the form with the reason, and a source that cannot be fetched stops the edit', async ({ page }) => {
  await open(page, server({ failEdit: true }));
  const { dialog, text, save } = await startEdit(page);
  await text.fill('Changed');
  await save.click();
  await expect(dialog.getByRole('alert')).toContainText('Validation failed');
  await expect(dialog).toBeVisible();
});

test('without the text from the server nothing can be saved', async ({ page }) => {
  await open(page, server({ failSource: true }));
  const { dialog, save } = await startEdit(page);
  await expect(dialog.getByRole('alert')).toContainText('Something went wrong');
  await expect(save).toBeDisabled();
});
