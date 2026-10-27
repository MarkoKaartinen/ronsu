import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

async function openProfile(page: Page, server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  // DOM click: no automatic scrolling by Playwright
  await page.locator('article[data-id] a.profile').first().evaluate((el: HTMLElement) => el.click());
  await expect(page.getByRole('heading', { name: 'U' })).toBeVisible();
  await expect(page.locator('.tabs ~ .results article[data-id]')).toHaveCount(5);
}

const ids = (page: Page) => page.locator('.tabs ~ .results article[data-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-id')));

test('the profile has the posts, the posts and replies and the media as tabs', async ({ page }) => {
  const server: Server = { marker: null, posts: [] };
  await openProfile(page, server);
  const tab = (name: string) => page.locator('.tabs').getByRole('button', { name, exact: true });

  // The posts leave out the replies to others, as before
  await expect(tab('Posts')).toHaveAttribute('aria-pressed', 'true');
  expect(server.profileRequests?.find((q) => !q.pinned)).toMatchObject({ exclude_replies: 'true' });
  expect(await ids(page)).toEqual([14, 13, 12, 11, 10].map(idOf));

  await tab('Media').click();
  await expect(tab('Media')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.tabs ~ .results article[data-id]')).toHaveCount(3);
  expect(await ids(page)).toEqual([12, 9, 6].map(idOf));
  expect(server.profileRequests?.at(-1)).toMatchObject({ only_media: 'true' });
  expect(server.profileRequests?.at(-1)).not.toHaveProperty('exclude_replies');

  await tab('Posts and replies').click();
  await expect(page.locator('.tabs ~ .results article[data-id]')).toHaveCount(5);
  expect(await ids(page)).toEqual([24, 23, 22, 21, 20].map(idOf));
  expect(server.profileRequests?.at(-1)).not.toHaveProperty('exclude_replies');
  expect(server.profileRequests?.at(-1)).not.toHaveProperty('only_media');

  await tab('Posts').click();
  await expect(page.locator('.tabs ~ .results article[data-id]')).toHaveCount(5);
  expect(await ids(page)).toEqual([14, 13, 12, 11, 10].map(idOf));
});

test('an answer that comes after another tab was chosen is dropped', async ({ page }) => {
  await openProfile(page, { marker: null, posts: [] });
  // The answer for the posts and replies is slow: the media tab is chosen before it comes
  await page.locator('.tabs').getByRole('button', { name: 'Posts and replies', exact: true }).click();
  await page.locator('.tabs').getByRole('button', { name: 'Media', exact: true }).click();
  await expect(page.locator('.tabs ~ .results article[data-id]')).toHaveCount(3);
  await page.waitForTimeout(700);
  expect(await ids(page)).toEqual([12, 9, 6].map(idOf));
  await expect(page.locator('.tabs').getByRole('button', { name: 'Media', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('pinned posts are first on the posts tab, marked, and not in the list twice', async ({ page }) => {
  const server: Server = { marker: null, posts: [], pinnedPost: true };
  await openProfile(page, server);
  expect(server.profileRequests).toContainEqual({ pinned: 'true' });
  expect(await ids(page)).toEqual([12, 14, 13, 11, 10].map(idOf));
  await expect(page.locator('.tabs ~ .results article[data-id]').first().getByText('Pinned post')).toBeVisible();
  await expect(page.getByText('Pinned post')).toHaveCount(1);

  // The other tabs list posts by time and do not mark any
  await page.locator('.tabs').getByRole('button', { name: 'Media', exact: true }).click();
  await expect(page.locator('.tabs ~ .results article[data-id]')).toHaveCount(3);
  await expect(page.getByText('Pinned post')).toHaveCount(0);
});

test('without pinned posts the posts tab is as it was', async ({ page }) => {
  await openProfile(page, { marker: null, posts: [] });
  await expect(page.getByText('Pinned post')).toHaveCount(0);
});

test('changing the tab empties the list, says it is loading and keeps the place on the page', async ({ page }) => {
  await openProfile(page, { marker: null, posts: [] });
  // The tabs at the top of the screen. The answer for the posts and replies is slow, so the wait is long enough to look
  const top = await page.locator('.tabs').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((y) => window.scrollTo(0, y), top);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(100);

  await page.locator('.tabs').getByRole('button', { name: 'Posts and replies', exact: true }).evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(200); // the answer is still on its way
  await expect(page.locator('.results').getByText('Loading…')).toBeVisible();
  expect(await ids(page)).toEqual([]);
  expect(await page.evaluate(() => window.scrollY)).toBe(before); // the page has not shrunk under the reader

  await expect(page.locator('.tabs ~ .results article[data-id]')).toHaveCount(5);
  expect(await ids(page)).toEqual([24, 23, 22, 21, 20].map(idOf));
  await expect(page.locator('.results')).not.toHaveAttribute('style', /min-height/); // the held height is let go
});
