import { expect, test, type Page } from '@playwright/test';
import { mockMastodon, seedAccount } from './mock';

const account = { id: '2', username: 'maija', acct: 'maija', display_name: 'Maija', avatar: 'https://mock.test/img/a.png', emojis: [] };
const conversation = (n: number, unread: boolean) => ({
  id: String(n),
  unread,
  accounts: [account],
  last_status: {
    id: String(7000 + n), created_at: new Date().toISOString(), content: `<p>Private ${n}</p>`, spoiler_text: '', sensitive: false,
    visibility: 'direct', account, media_attachments: [], mentions: [], tags: [], emojis: [], reblog: null, in_reply_to_id: null,
    replies_count: 0, reblogs_count: 0, favourites_count: 0, url: `https://mock.test/s/${n}`,
  },
});

/**
 * `list` is what the server has; the ids of the conversations that were marked read are collected in `read`.
 * `firstPage`: the server gives that many conversations first and the rest after `max_id=555` (the cursor of its Link header).
 */
async function open(page: Page, list: ReturnType<typeof conversation>[], firstPage = list.length) {
  const read: string[] = [];
  await mockMastodon(page, { marker: null, posts: [] });
  // Registered after the general mock, so it answers first
  await page.route('https://mock.test/api/v1/conversations**', async (route) => {
    const url = new URL(route.request().url());
    const mark = url.pathname.match(/conversations\/(\d+)\/read$/);
    if (mark) {
      read.push(mark[1]);
      const c = list.find((x) => x.id === mark[1]);
      if (c) c.unread = false;
    }
    const paged = !mark && firstPage < list.length;
    const older = !!url.searchParams.get('max_id');
    await route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'Link', 'content-type': 'application/json',
        ...(paged && !older ? { link: '<https://mock.test/api/v1/conversations?limit=20&max_id=555>; rel="next"' } : {}),
      },
      body: JSON.stringify(mark ? (list.find((x) => x.id === mark[1]) ?? {}) : paged ? (older ? list.slice(firstPage) : list.slice(0, firstPage)) : list),
    });
  });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  return read;
}

test('phone: the envelope in the bottom bar has a dot while something is unread, opening the view reads it', async ({ page }) => {
  const read = await open(page, [conversation(1, true), conversation(2, false)]);
  const button = page.getByRole('button', { name: 'Private mentions, new' });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByText('Private 1')).toBeVisible();
  await expect(page.getByText('Private 2')).toBeVisible();
  await expect(page.locator('.messages').getByText('Maija').first()).toBeVisible();
  await expect.poll(() => read).toEqual(['1']);
  // The list marks the unread one (it stays marked for this visit), and does not say "private mention" on every post
  await expect(page.locator('.messages .dot')).toHaveCount(1);
  await expect(page.locator('.messages .item', { hasText: 'Private 1' }).locator('.dot')).toHaveCount(1);
  await expect(page.locator('.messages .private')).toHaveCount(0);
  // Read: the dot is gone
  await expect(page.getByRole('button', { name: 'Private mentions', exact: true })).toBeVisible();
  await expect(page.locator('nav.bar button.on')).toHaveAttribute('aria-current', 'page');
});

test('wide screen: private mentions are in the sidebar and open in the middle column', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page, [conversation(1, false)]);
  await page.locator('.side').getByRole('button', { name: 'Private mentions' }).click();
  await expect(page.getByText('Private 1')).toBeVisible();
  await expect(page.locator('.side .link.on')).toHaveAttribute('aria-current', 'page');
  await page.locator('.side').getByRole('button', { name: 'Home' }).click();
  await expect(page.locator('.list > article[data-id]').first()).toBeVisible();
});

test('a private mention in the home feed says so', async ({ page }) => {
  await mockMastodon(page, { marker: null, posts: [] });
  const post = { ...conversation(1, false).last_status, id: '109000000000000150' };
  await page.route('https://mock.test/api/v1/timelines/home**', (route) =>
    route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify([post]) }),
  );
  await seedAccount(page);
  await page.reload();
  await expect(page.locator('article[data-id] .private')).toHaveText('Private mention');
});

test('no private mentions yet: the empty state says so', async ({ page }) => {
  await open(page, []);
  await page.getByRole('button', { name: 'Private mentions' }).click();
  await expect(page.getByText("You don't have any private mentions yet.")).toBeVisible();
});

test('more conversations than one page: Load older fetches the rest by the cursor of the Link header', async ({ page }) => {
  await open(page, [conversation(1, false), conversation(2, false), conversation(3, false)], 2);
  await page.getByRole('button', { name: 'Private mentions' }).click();
  await expect(page.getByText('Private 2')).toBeVisible();
  await expect(page.getByText('Private 3')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load older' }).click();
  await expect(page.getByText('Private 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load older' })).toHaveCount(0);
});
