import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Page, server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

async function openTag(page: Page) {
  // DOM click: no automatic scrolling by Playwright
  await page.locator('article[data-id] a.hashtag').first().evaluate((el: HTMLElement) => el.click());
  await expect(page).toHaveURL(/#\/tag\/ronsu$/);
}

test('a hashtag in a post opens its view with the posts, and back returns to the feed', async ({ page }) => {
  const server: Server = { marker: null, posts: [], hashtags: true };
  await open(page, server);
  await openTag(page);

  await expect(page.getByRole('heading', { name: '#ronsu' })).toBeVisible();
  await expect(page.locator('article[data-id]:visible')).toHaveCount(20);
  expect(server.tagTimelines?.[0]).toEqual({ tag: 'ronsu', maxId: null });

  // The next page starts after the oldest post of the first
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByText('No more posts.')).toBeVisible();
  expect(server.tagTimelines?.[1]).toEqual({ tag: 'ronsu', maxId: idOf(10) });

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).not.toHaveURL(/#\/tag/);
  await expect(page.locator('article[data-id]:visible').first()).toBeVisible();
});

test('the view of a hashtag opens from a link too', async ({ page }) => {
  await open(page, { marker: null, posts: [], hashtags: true });
  await page.evaluate(() => (location.hash = '#/tag/ronsu'));
  await expect(page.getByRole('heading', { name: '#ronsu' })).toBeVisible();
  await expect(page.locator('article[data-id]:visible')).toHaveCount(20);
});

test('following and unfollowing a hashtag', async ({ page }) => {
  const server: Server = { marker: null, posts: [], hashtags: true };
  await open(page, server);
  await openTag(page);

  await page.getByRole('button', { name: 'Follow hashtag' }).click();
  await expect(page.getByRole('button', { name: 'Unfollow hashtag' })).toBeVisible();
  await page.getByRole('button', { name: 'Unfollow hashtag' }).click();
  await expect(page.getByRole('button', { name: 'Follow hashtag' })).toBeVisible();
  expect(server.tagFollows).toEqual(['follow', 'unfollow']);
});

test('a hashtag that is followed already says so', async ({ page }) => {
  await open(page, { marker: null, posts: [], hashtags: true, tagFollowing: true });
  await openTag(page);
  await expect(page.getByRole('button', { name: 'Unfollow hashtag' })).toBeVisible();
});

test('a failed follow keeps the button and tells why', async ({ page }) => {
  await open(page, { marker: null, posts: [], hashtags: true, failTagFollow: true });
  await openTag(page);
  await page.getByRole('button', { name: 'Follow hashtag' }).click();
  await expect(page.getByRole('alert')).toContainText('Following the hashtag failed: Ei onnistu');
  await expect(page.getByRole('button', { name: 'Follow hashtag' })).toBeVisible();
});

test('a last paragraph of hashtags is a row of links under the post, and a link opens the hashtag', async ({ page }) => {
  await open(page, { marker: null, posts: [], hashtags: true, hashtagLine: true });
  const post = page.locator('article[data-id]', { has: page.locator('.tags') }).first();
  await expect(post.locator('.content')).not.toContainText(/#ronsu/i);
  await expect(post.locator('.tags a')).toHaveText(['#ronsu', '#mastodon']);

  await post.locator('.tags a').nth(1).evaluate((el: HTMLElement) => el.click());
  await expect(page).toHaveURL(/#\/tag\/mastodon$/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).not.toHaveURL(/#\/tag/);
});

test('a hashtag inside the text stays in the text', async ({ page }) => {
  await open(page, { marker: null, posts: [], hashtags: true });
  await expect(page.locator('.tags')).toHaveCount(0);
  await expect(page.locator('article[data-id] .content a.hashtag').first()).toContainText('#Ronsu');
  await expect(page.locator('.tags')).toHaveCount(0); // and not once more under the post
});

test('hashtags that end the text of a post are moved under it too', async ({ page }) => {
  await open(page, { marker: null, posts: [], hashtags: true, hashtagEnd: true });
  const post = page.locator('article[data-id]', { has: page.locator('.tags') }).first();
  await expect(post.locator('.content')).toContainText('Lorem ipsum dolor sit amet.');
  await expect(post.locator('.content')).not.toContainText(/#ronsu|#mastodon/i);
  await expect(post.locator('.tags a')).toHaveText(['#ronsu', '#mastodon']);
});

test('the hashtags are the last thing under a post, after the pictures and the link preview', async ({ page }) => {
  await open(page, { marker: null, posts: [], hashtags: true, hashtagLine: true, cards: true });
  const post = page.locator('article[data-id]', { has: page.locator('.preview') }).filter({ has: page.locator('.tags') }).first();
  await expect(post.locator('.preview ~ .tags')).toHaveCount(1);
});
