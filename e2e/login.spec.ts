import { expect, test } from '@playwright/test';

/** The scopes of an older version, to test that its registration is not reused */
const OLD_SCOPES = 'read write:favourites write:statuses write:media write:bookmarks write:follows';
const SCOPES = 'read:accounts read:statuses read:notifications read:follows write:favourites write:statuses write:media write:bookmarks write:follows push';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };

test('logging in registers the app as "Ronsu" and ignores an older registration made under another name', async ({ page }) => {
  const registrations: Record<string, unknown>[] = [];
  let authorizeUrl = '';
  await page.route('https://mock.test/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/api/v1/apps') {
      registrations.push(req.postDataJSON());
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ client_id: 'new-id', client_secret: 'new-secret' }) });
    }
    if (url.pathname === '/oauth/authorize') {
      authorizeUrl = req.url();
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<p>authorize</p>' });
    }
    return route.fulfill({ status: 404, headers: cors, body: '{}' });
  });

  await page.goto('/');
  // An old registration, stored the way earlier versions did (no app name in the key)
  await page.evaluate(async ({ key }) => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const r = indexedDB.open('keyval-store');
      r.onupgradeneeded = () => r.result.createObjectStore('keyval');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put({ clientId: 'old-id', clientSecret: 'old-secret' }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, { key: `app|mock.test|http://localhost:4173/|${OLD_SCOPES}` });

  await page.reload();
  await page.getByRole('textbox', { name: 'Server' }).fill('mock.test');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect.poll(() => authorizeUrl).not.toBe('');

  // A new registration was made (the old one did not match), under the name Ronsu
  expect(registrations).toHaveLength(1);
  expect(registrations[0]).toMatchObject({ client_name: 'Ronsu', redirect_uris: 'http://localhost:4173/', website: 'http://localhost:4173' });
  expect(String(registrations[0].scopes)).toBe(SCOPES);

  const params = new URL(authorizeUrl).searchParams;
  expect(params.get('client_id')).toBe('new-id');
  expect(params.get('code_challenge_method')).toBe('S256');
  expect(params.get('redirect_uri')).toBe('http://localhost:4173/');
  expect(params.get('scope')).toBe(SCOPES);
  expect(params.get('scope')!.split(' ')).not.toContain('read');

  // The login in progress waits in this tab only (sessionStorage), with its start time, not in localStorage
  await page.goBack(); // from the server's page back to the app, in the same tab
  // The page may still be navigating (the service worker can reload it), so read again until the context is stable
  let stored: { session: string | null; local: string | null } | null = null;
  await expect
    .poll(async () => {
      stored = await page.evaluate(() => ({ session: sessionStorage.getItem('oauth-pending'), local: localStorage.getItem('oauth-pending') })).catch(() => null);
      return stored;
    })
    .not.toBeNull();
  expect(stored!.local).toBeNull();
  expect(JSON.parse(stored!.session!)).toMatchObject({ state: params.get('state'), instance: 'mock.test' });
  expect(JSON.parse(stored!.session!).startedAt).toBeGreaterThan(Date.now() - 60_000);
});

test.describe('the return from the server', () => {
  const pending = (over: Record<string, unknown> = {}) =>
    JSON.stringify({ instance: 'mock.test', clientId: 'c', clientSecret: 's', verifier: 'v'.repeat(43), state: 'good-state', redirectUri: 'http://localhost:4173/', startedAt: Date.now(), ...over });

  async function comeBack(page: import('@playwright/test').Page, query: string, stored: string | null) {
    const tokenRequests: string[] = [];
    await page.route('https://mock.test/**', async (route) => {
      const req = route.request();
      if (new URL(req.url()).pathname === '/oauth/token') tokenRequests.push(req.postData() ?? '');
      return route.fulfill({ status: 400, headers: cors, body: '{"error":"invalid_grant"}' });
    });
    await page.goto('/');
    if (stored) await page.evaluate((v) => sessionStorage.setItem('oauth-pending', v), stored);
    await page.goto(`/${query}`);
    return tokenRequests;
  }

  test('a wrong state is refused without asking for a token, and the code leaves the address bar', async ({ page }) => {
    const tokens = await comeBack(page, '?code=abc&state=forged', pending());
    await expect(page.getByText('Login verification failed')).toBeVisible();
    expect(tokens).toEqual([]);
    expect(new URL(page.url()).search).toBe('');
  });

  test('a callback without a login in progress, or one that is too old, is refused', async ({ page }) => {
    let tokens = await comeBack(page, '?code=abc&state=good-state', null);
    await expect(page.getByText('The login state is missing')).toBeVisible();
    expect(tokens).toEqual([]);
    tokens = await comeBack(page, '?code=abc&state=good-state', pending({ startedAt: Date.now() - 11 * 60 * 1000 }));
    await expect(page.getByText('The login took too long')).toBeVisible();
    expect(tokens).toEqual([]);
  });

  test('a cancelled login shows the server\'s message only for our own request', async ({ page }) => {
    await comeBack(page, '?error=access_denied&error_description=The+owner+said+no&state=good-state', pending());
    await expect(page.getByText('The owner said no')).toBeVisible();
    await comeBack(page, '?error=access_denied&error_description=Call+this+number&state=forged', pending());
    await expect(page.getByText('Login verification failed')).toBeVisible();
    await expect(page.getByText('Call this number')).toHaveCount(0);
  });

  test('the right state with a refused code reports the failure and cannot be repeated', async ({ page }) => {
    const tokens = await comeBack(page, '?code=abc&state=good-state', pending());
    await expect(page.getByText('Fetching the access token failed (400)')).toBeVisible();
    expect(tokens).toHaveLength(1);
    expect(JSON.parse(tokens[0])).toMatchObject({ code: 'abc', code_verifier: 'v'.repeat(43) });
    // The same address again (a reload, a back button): the login in progress is used up
    await page.goto('/?code=abc&state=good-state');
    await expect(page.getByText('The login state is missing')).toBeVisible();
    expect(tokens).toHaveLength(1);
  });
});
