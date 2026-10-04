import { expect, test } from '@playwright/test';

const SCOPES = 'read write:favourites write:statuses write:bookmarks write:follows';
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
  }, { key: `app|mock.test|http://localhost:4173/|${SCOPES}` });

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
});
