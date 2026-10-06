import { expect, test, type Page } from '@playwright/test';
import { mockMastodon, seedAccount, type Server } from './mock';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const png = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });

async function openCompose(page: Page, server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.getByRole('button', { name: 'New post' }).first().click();
  return page.getByRole('dialog').first();
}

const newServer = (over: Partial<Server> = {}): Server => ({ marker: null, posts: [], created: [], attempts: [], ...over });

test('a picture is chosen, described and posted with its alt text', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  await dialog.locator('input[type=file]').setInputFiles(png('cat.png'));
  await expect(dialog.locator('.media li')).toHaveCount(1);
  await expect(dialog.locator('.progress')).toBeHidden();
  expect(server.uploads).toEqual(['cat.png']);

  // A post with only a picture is allowed; the reminder asks for the alt text first
  await dialog.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(dialog.getByText('Add alt text?')).toBeVisible();
  expect(server.created).toHaveLength(0);

  await dialog.getByRole('button', { name: 'Add alt text' }).click();
  const alt = page.getByRole('dialog', { name: 'Add alt text' });
  await alt.getByRole('textbox').fill('A grey cat on a sofa');
  await alt.getByRole('button', { name: 'Done' }).click();
  await expect(dialog.locator('.alt.set')).toBeVisible();

  await dialog.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(server.descriptions).toEqual({ up1: 'A grey cat on a sofa' });
  expect(server.created![0].body).toMatchObject({ status: '', media_ids: ['up1'] });
});

test('"Post anyway" posts without alt text', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  await dialog.getByRole('textbox', { name: /on your mind/ }).fill('Look');
  await dialog.locator('input[type=file]').setInputFiles(png('a.png'));
  await expect(dialog.locator('.media li')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Post', exact: true }).click();
  await dialog.getByRole('button', { name: 'Post anyway' }).click();
  await expect(dialog).toBeHidden();
  expect(server.created![0].body).toMatchObject({ status: 'Look', media_ids: ['up1'] });
  expect(server.descriptions).toBeUndefined();
});

test('the post waits until the server has processed the picture', async ({ page }) => {
  const server = newServer({ processing: true });
  const dialog = await openCompose(page, server);
  await dialog.locator('input[type=file]').setInputFiles(png('a.png'));
  await expect(dialog.getByText('Processing…')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Post', exact: true })).toBeDisabled();
  await expect(dialog.getByText('Processing…')).toBeHidden({ timeout: 5000 });
  await expect(dialog.getByRole('button', { name: 'Post', exact: true })).toBeEnabled();
});

test('a picture is pasted from the clipboard, but pasted text stays text', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  const box = dialog.getByRole('textbox', { name: /on your mind/ });
  await box.evaluate((el) => {
    const data = new DataTransfer();
    data.items.add(new File(['x'], 'shot.png', { type: 'image/png' }));
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(dialog.locator('.media li')).toHaveCount(1);
  await box.evaluate((el) => {
    const data = new DataTransfer();
    data.setData('text/plain', 'just text');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(dialog.locator('.media li')).toHaveCount(1);
  expect(server.uploads).toEqual(['shot.png']);
});

test('a picture is dropped on the form', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  await dialog.evaluate((el) => {
    const data = new DataTransfer();
    data.items.add(new File(['x'], 'dropped.png', { type: 'image/png' }));
    const opts = { dataTransfer: data, bubbles: true, cancelable: true };
    el.dispatchEvent(new DragEvent('dragover', opts));
    el.dispatchEvent(new DragEvent('drop', opts));
  });
  await expect(dialog.locator('.media li')).toHaveCount(1);
  expect(server.uploads).toEqual(['dropped.png']);
});

test('no more than the server allows, and a picture can be removed', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  await dialog.locator('input[type=file]').setInputFiles([1, 2, 3, 4, 5].map((n) => png(`${n}.png`)));
  await expect(dialog.locator('.media li')).toHaveCount(4);
  await expect(dialog.getByText('File upload limit exceeded.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Add images/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Remove' }).first().click();
  await expect(dialog.locator('.media li')).toHaveCount(3);
  await expect(dialog.getByRole('button', { name: /Add images/ })).toBeEnabled();
});

test('an old login without the write:media permission is asked to log in again', async ({ page }) => {
  const dialog = await openCompose(page, newServer({ noMediaScope: true }));
  await dialog.locator('input[type=file]').setInputFiles(png('a.png'));
  await expect(dialog.getByText(/needs a new permission/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Log in again' })).toBeVisible();
  await expect(dialog.locator('.media li')).toHaveCount(0);
});
