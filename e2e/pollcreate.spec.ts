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

const newServer = (over: Partial<Server> = {}): Server => ({ marker: null, posts: [], created: [], attempts: [], ...over });
const post = (dialog: ReturnType<Page['getByRole']>) => dialog.getByRole('button', { name: 'Post', exact: true });

test('a poll is written and posted with its options, duration and style', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  await dialog.getByRole('textbox', { name: /on your mind/ }).fill('Which one?');
  await dialog.getByRole('button', { name: 'Add a poll' }).click();

  await dialog.getByLabel('Option 1').fill(' Tea ');
  await dialog.getByLabel('Option 2').fill('Coffee');
  await expect(dialog.getByLabel('Option 3')).toBeVisible(); // the next one appears when the last is filled
  await dialog.getByLabel('Poll duration').selectOption({ label: '1h' });
  await dialog.getByLabel('Style').selectOption({ label: 'Multiple choice' });
  await post(dialog).click();

  await expect(dialog).toBeHidden();
  expect(server.created![0].body).toMatchObject({
    status: 'Which one?',
    poll: { options: ['Tea', 'Coffee'], expires_in: 3600, multiple: true }, // the empty third option is not sent
  });
});

test('the post waits for two different options, and Enter in an option does not send it', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  await dialog.getByRole('textbox', { name: /on your mind/ }).fill('Which one?');
  await dialog.getByRole('button', { name: 'Add a poll' }).click();
  await expect(post(dialog)).toBeDisabled();

  await dialog.getByLabel('Option 1').fill('Tea');
  await expect(post(dialog)).toBeDisabled();
  await dialog.getByLabel('Option 2').fill('Tea');
  await expect(post(dialog)).toBeDisabled(); // the same option twice
  await dialog.getByLabel('Option 2').fill('Coffee');
  await expect(post(dialog)).toBeEnabled();

  await dialog.getByLabel('Option 1').press('Enter');
  await expect(dialog.getByLabel('Option 2')).toBeFocused();
  expect(server.created).toHaveLength(0);
});

test('the limits of the server decide the number and length of options and the durations', async ({ page }) => {
  const server = newServer({ pollLimits: { max_options: 3, max_characters_per_option: 10, min_expiration: 1800, max_expiration: 21_600 } });
  const dialog = await openCompose(page, server);
  await dialog.getByRole('button', { name: 'Add a poll' }).click();

  await expect(dialog.getByLabel('Option 1')).toHaveAttribute('maxlength', '10');
  await dialog.getByLabel('Option 1').fill('One');
  await dialog.getByLabel('Option 2').fill('Two');
  await dialog.getByLabel('Option 3').fill('Three');
  await expect(dialog.getByLabel('Option 4')).toHaveCount(0);
  await expect(dialog.getByLabel('Poll duration').locator('option')).toHaveText(['30m', '1h', '6h']);
  await expect(dialog.getByLabel('Poll duration')).toHaveValue('21600'); // a day is too long here: the longest is the start
});

test('an option is removed, and the poll too', async ({ page }) => {
  const dialog = await openCompose(page, newServer());
  await dialog.getByRole('button', { name: 'Add a poll' }).click();
  await expect(dialog.getByRole('button', { name: 'Remove option' })).toHaveCount(0); // two is the least

  await dialog.getByLabel('Option 1').fill('Tea');
  await dialog.getByLabel('Option 2').fill('Coffee');
  await expect(dialog.getByLabel('Option 3')).toBeVisible();
  await dialog.getByRole('button', { name: 'Remove option' }).first().click();
  await expect(dialog.getByLabel('Option 1')).toHaveValue('Coffee');

  await dialog.getByRole('button', { name: 'Remove poll' }).click();
  await expect(dialog.getByLabel('Option 1')).toHaveCount(0);
});

test('a picture and a poll go in the same post', async ({ page }) => {
  const server = newServer();
  const dialog = await openCompose(page, server);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await dialog.getByRole('textbox', { name: /on your mind/ }).fill('Which cat?');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'cat.png', mimeType: 'image/png', buffer: png });
  await expect(dialog.locator('.progress')).toBeHidden();
  await dialog.getByRole('button', { name: 'Add a poll' }).click();
  await dialog.getByLabel('Option 1').fill('Grey');
  await dialog.getByLabel('Option 2').fill('Black');
  await post(dialog).click();
  await dialog.getByRole('button', { name: 'Post anyway' }).click(); // no alt text

  await expect(dialog).toBeHidden();
  expect(server.created![0].body).toMatchObject({ media_ids: ['up1'], poll: { options: ['Grey', 'Black'] } });
});

test('a server that does not tell its limits gets Mastodon\'s', async ({ page }) => {
  const dialog = await openCompose(page, newServer({ pollLimits: null }));
  await dialog.getByRole('button', { name: 'Add a poll' }).click();
  await expect(dialog.getByLabel('Option 1')).toHaveAttribute('maxlength', '50');
});

test('a quote post has no poll, like in Mastodon', async ({ page }) => {
  await mockMastodon(page, newServer());
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.locator('article[data-id]').first().getByRole('button', { name: 'Quote' }).click();

  await expect(page.getByRole('dialog').getByRole('button', { name: 'Add a poll' })).toBeDisabled();
});
