import { expect, test } from '@playwright/test';
import { mockMastodon, seedAccount, SCOPES } from './mock';

// Logging in again to the same account (new permissions) replaces its token and revokes the old one: the feed that
// was already on screen must go on with the new token, not show "token revoked" until the page is reloaded
test('after logging in again the feed uses the new token', async ({ page }) => {
  await mockMastodon(page, { marker: null, posts: [] });
  const tokensSeen: string[] = [];
  await page.route('https://mock.test/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/oauth/token') {
      return route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' },
        body: JSON.stringify({ access_token: 'new-token', token_type: 'Bearer', scope: SCOPES, created_at: 0 }),
      });
    }
    if (path === '/api/v1/accounts/verify_credentials') {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ id: '1', username: 'me', acct: 'me', display_name: 'Me', avatar: '', source: { privacy: 'public' } }) });
    }
    if (path === '/api/v1/timelines/home') tokensSeen.push(req.headers()['authorization'] ?? '');
    return route.fallback();
  });
  await seedAccount(page);
  await page.evaluate(() =>
    sessionStorage.setItem('oauth-pending', JSON.stringify({ instance: 'mock.test', clientId: 'c', clientSecret: 's', verifier: 'v'.repeat(43), state: 'good-state', redirectUri: 'http://localhost:4173/', startedAt: Date.now() })),
  );
  await page.goto('/?code=abc&state=good-state');
  await page.waitForSelector('article[data-id]');
  await expect.poll(() => page.evaluate(() => location.search)).toBe('');
  // Whatever the feed asks for after the login carries the new token
  tokensSeen.length = 0;
  await page.getByRole('button', { name: 'Load older' }).click();
  await expect.poll(() => tokensSeen.length).toBeGreaterThan(0);
  expect(new Set(tokensSeen)).toEqual(new Set(['Bearer new-token']));
});
