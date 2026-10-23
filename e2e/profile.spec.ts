import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Page, server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

async function openProfile(page: Page) {
  // DOM click: no automatic scrolling by Playwright
  await page.locator('article[data-id] a.profile').first().evaluate((el: HTMLElement) => el.click());
  await expect(page).toHaveURL(/#\/user\/@u$/);
  await expect(page.getByRole('heading', { name: 'U' })).toBeVisible();
}

test('the profile opens from the avatar and shows the details and posts', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  await openProfile(page);
  await expect(page.getByText('About me')).toBeVisible();
  await expect(page.locator('.counts')).toContainText('1,234'); // posts (en formatting)
  await expect(page.locator('article[data-id]:visible')).toHaveCount(5);
  await expect(page.getByText('Follows you')).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).not.toHaveURL(/#\/user/);
});

test('following and unfollowing update immediately', async ({ page }) => {
  const server: Server = { marker: null, posts: [], follows: [] };
  await open(page, server);
  await openProfile(page);
  const followers = page.locator('.counts div').nth(2);

  await expect(followers).toContainText('10');
  await page.getByRole('button', { name: 'Follow', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible();
  await expect(followers).toContainText('11');

  await page.getByRole('button', { name: 'Unfollow' }).click();
  await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();
  await expect(followers).toContainText('10');
  expect(server.follows).toEqual(['follow', 'unfollow']);
});

test('following a locked account is a request', async ({ page }) => {
  await open(page, { marker: null, posts: [], locked: true });
  await openProfile(page);
  await page.getByRole('button', { name: 'Request to follow', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel request' })).toBeVisible();
  await expect(page.locator('.counts div').nth(2)).toContainText('10');
});

test('missing scope: the state is restored and a new login is offered', async ({ page }) => {
  await open(page, { marker: null, posts: [], noFollowScope: true });
  await openProfile(page);
  await page.getByRole('button', { name: 'Follow', exact: true }).click();
  await expect(page.getByText('needs a new permission')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();
});

test('an @mention opens the profile and an empty spot on the card opens the thread', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  await page.locator(`article[data-id="${idOf(162)}"] a.mention`).evaluate((el: HTMLElement) => el.click());
  await expect(page).toHaveURL(/#\/user\/@maija$/); // the handle from the mention, not a numeric id
  await page.getByRole('button', { name: 'Back' }).click();

  await page.locator('article[data-id]').first().click({ position: { x: 4, y: 4 } });
  await expect(page).toHaveURL(/#\/thread\/\d+$/);
});

test('a profile opens directly from its handle URL and from an older numeric id link', async ({ page }) => {
  await open(page, { marker: null, posts: [] });

  await page.evaluate(() => (location.hash = '/user/@u'));
  await expect(page.getByRole('heading', { name: 'U' })).toBeVisible();
  await expect(page.locator('.counts')).toContainText('1,234');

  await page.evaluate(() => (location.hash = '/'));
  await page.evaluate(() => (location.hash = '/user/2'));
  await expect(page.getByRole('heading', { name: 'U' })).toBeVisible();
});

test('the follow button sits on the banner', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  await openProfile(page);
  const banner = (await page.locator('.banner').boundingBox())!;
  const button = (await page.getByRole('button', { name: 'Follow', exact: true }).boundingBox())!;
  expect(button.y).toBeGreaterThanOrEqual(banner.y);
  expect(button.y + button.height).toBeLessThanOrEqual(banner.y + banner.height);
  expect(button.x + button.width).toBeLessThanOrEqual(banner.x + banner.width);
});

test('the handle links to the account page on its own server', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  await openProfile(page);
  const link = page.locator('.acct').getByRole('link', { name: '@u' });
  await expect(link).toHaveAttribute('title', 'View on mock.test');
  await expect(link).toHaveAttribute('href', 'https://mock.test/@u');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
});

test('the profile fields (links) are shown, verified links are marked and links open in a new tab', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  await openProfile(page);
  const fields = page.locator('dl.fields');
  await expect(fields).toContainText('Website');
  await expect(fields).toContainText('Pronouns');
  await expect(fields).toContainText('they/them');

  const link = fields.getByRole('link', { name: /example\.org/ });
  await expect(link).toHaveAttribute('href', 'https://example.org');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);

  // Only the verified link gets the check mark, with the date in its description
  await expect(fields.locator('.check')).toHaveCount(1);
  await expect(fields.locator('.check')).toHaveAttribute('title', /Ownership of this link was checked on/);
});

test('two profile fields with the same name do not crash the page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, { marker: null, posts: [], dupFields: true });
  await openProfile(page);
  await expect(page.locator('dl.fields .field')).toHaveCount(2);
  await expect(page.locator('dl.fields')).toContainText('example.org');
  await expect(page.locator('dl.fields')).toContainText('example.net');
  expect(errors).toEqual([]);
});

test('muting and blocking from the menu update the profile', async ({ page }) => {
  const server: Server = { marker: null, posts: [] };
  await open(page, server);
  await openProfile(page);

  await page.locator('.action').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Mute @u' }).click();
  await page.getByLabel('Duration').selectOption({ label: '1 day' });
  await page.getByLabel('Hide notifications from this user').uncheck();
  await page.getByRole('dialog').getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(page.locator('.acct .badge', { hasText: 'Muted' })).toBeVisible();

  await page.locator('.action').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Unmute @u' }).click();
  await expect(page.locator('.acct .badge', { hasText: 'Muted' })).toHaveCount(0);

  await page.locator('.action').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Block @u' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  expect(server.moderations).toEqual(['mute', 'unmute']);
  await page.locator('.action').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Block @u' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Block', exact: true }).click();
  await expect(page.locator('.acct .badge', { hasText: 'Blocked' })).toBeVisible();

  await page.locator('.action').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Unblock @u' }).click();
  await expect(page.locator('.acct .badge', { hasText: 'Blocked' })).toHaveCount(0);
  expect(server.moderations).toEqual(['mute', 'unmute', 'block', 'unblock']);
  expect(server.muteBodies).toEqual([{ duration: 86400, notifications: false }]);
});

test('muting without the scope offers a new login', async ({ page }) => {
  await open(page, { marker: null, posts: [], noModerationScope: true });
  await openProfile(page);
  await page.locator('.action').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Mute @u' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(page.getByText('Muting and blocking need a new permission')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in again' })).toBeVisible();
});

test('the menu of a post opens the original, copies the link and mutes and blocks the author', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const server: Server = { marker: null, posts: [] };
  await open(page, server);
  const post = page.locator('article[data-id]').first();

  await post.getByRole('button', { name: 'More' }).click();
  await expect(post.getByRole('menuitem', { name: 'Open original page' })).toHaveAttribute('href', /^https:\/\/mock\.test\//);
  await post.getByRole('menuitem', { name: 'Copy link to post' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^https:\/\/mock\.test\//);

  await post.getByRole('button', { name: 'More' }).click();
  await post.getByRole('menuitem', { name: /^Mute @/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mute', exact: true }).click();
  await post.getByRole('button', { name: 'More' }).click();
  await expect(post.getByRole('menuitem', { name: /^Unmute @/ })).toBeVisible();
  await post.getByRole('menuitem', { name: /^Block @/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Block', exact: true }).click();
  expect(server.moderations).toEqual(['mute', 'block']);
});

test('the menu of a post can mute its conversation when the user is in it', async ({ page }) => {
  const server: Server = { marker: null, posts: [], muteThread: true };
  await open(page, server);
  const post = page.locator('article[data-id]').first();
  await post.getByRole('button', { name: 'More' }).click();
  await post.getByRole('menuitem', { name: 'Mute conversation' }).click();
  await post.getByRole('button', { name: 'More' }).click();
  await expect(post.getByRole('menuitem', { name: 'Unmute conversation' })).toBeVisible();
  expect(server.conversationMutes).toEqual(['mute']);
});

test('a conversation the user is not in has no mute item', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  const post = page.locator('article[data-id]').first();
  await post.getByRole('button', { name: 'More' }).click();
  await expect(post.getByRole('menuitem', { name: /^Mute @/ })).toBeVisible();
  await expect(post.getByRole('menuitem', { name: /conversation/ })).toHaveCount(0);
});

test('a remote account\'s server can be blocked after a confirmation, from the profile', async ({ page }) => {
  const server: Server = { marker: null, posts: [], remoteAccount: true };
  await open(page, server);
  await page.goto('/#/user/@u@mastodon.example');
  await page.locator('.action').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Block domain mastodon.example' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Block domain' }).click();
  await page.locator('.action').getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menuitem', { name: 'Unblock domain mastodon.example' })).toBeVisible();
  expect(server.domainBlocks).toEqual(['block:mastodon.example']);
});
