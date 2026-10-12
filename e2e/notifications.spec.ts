import { expect, test } from '@playwright/test';
import { mockMastodon, seedAccount, type Server } from './mock';

const account = { id: '1', username: 'u', acct: 'u', display_name: 'U', avatar: 'https://mock.test/img/a.png', emojis: [] };
/** Follow notifications on every other row so they are not merged into one: a mention has the post, which is enough here */
const mention = (n: number) => ({
  id: String(1000 + n),
  type: 'mention',
  created_at: new Date(Date.UTC(2026, 9, 4, 12, 0, 0) + n * 1000).toISOString(),
  account,
  status: {
    id: String(5000 + n), created_at: new Date().toISOString(), content: `<p>Mention ${n}</p>`, spoiler_text: '', sensitive: false,
    visibility: 'public', account, media_attachments: [], mentions: [], tags: [], emojis: [], reblog: null, in_reply_to_id: null,
    replies_count: 0, reblogs_count: 0, favourites_count: 0, url: `https://mock.test/s/${n}`,
  },
});

async function open(page: import('@playwright/test').Page, available: { max: number; delay?: number }) {
  const server: Server = { marker: null, posts: [] };
  await mockMastodon(page, server);
  // Registered after the general mock, so it answers first
  await page.route('https://mock.test/api/v1/notifications**', async (route) => {
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get('limit') ?? 30);
    const maxId = url.searchParams.get('max_id');
    const top = maxId ? Number(maxId) - 1000 - 1 : available.max;
    const list = Array.from({ length: Math.max(0, Math.min(limit, top + 1)) }, (_, i) => mention(top - i));
    await new Promise((r) => setTimeout(r, available.delay ?? 0));
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Link', 'content-type': 'application/json' },
      body: JSON.stringify(list),
    });
  });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.getByRole('button', { name: /Notifications/ }).click();
  await page.locator('.notifs article[data-id]').first().waitFor();
}

test('"Load new" shows that it is working, and says when there is nothing new', async ({ page }) => {
  await open(page, { max: 60, delay: 400 });
  const button = page.locator('.notifs .reload');
  await page.getByRole('button', { name: 'Load new' }).click();
  await expect(button).toHaveText(/Loading/);
  await expect(button).toBeDisabled();
  await expect(page.getByRole('alert').filter({ hasText: 'No new posts.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load new' })).toBeVisible();
});

test('new notifications keep the list to 50: the oldest are dropped and "Load older" brings them back', async ({ page }) => {
  const available = { max: 60 };
  await open(page, available);
  await page.locator('.notifs').getByRole('button', { name: 'Load older' }).click();
  await expect(page.locator('.notifs article[data-id]')).toHaveCount(60);

  available.max = 75; // fifteen new ones
  await page.getByRole('button', { name: 'Load new' }).click();
  await expect(page.locator('.notifs article[data-id]')).toHaveCount(50);
  await expect(page.getByText('Mention 75', { exact: true })).toBeVisible();
  await expect(page.getByText('Mention 25', { exact: true })).toHaveCount(0); // dropped from the end
  await page.locator('.notifs').getByRole('button', { name: 'Load older' }).click();
  await expect(page.getByText('Mention 25', { exact: true })).toHaveCount(1);
});
