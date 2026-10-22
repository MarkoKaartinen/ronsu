import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mockMastodon, seedAccount, type Server } from './mock';

const newServer = (over: Partial<Server> = {}): Server => ({ marker: null, posts: [], created: [], attempts: [], ...over });

async function open(page: Page, server: Server, tab = '') {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  if (tab) await page.evaluate((h) => (location.hash = h), tab);
}

const visibility = (page: Page) => page.getByRole('dialog').getByRole('combobox', { name: 'Visibility' });
const openNewPost = async (page: Page) => {
  await page.getByRole('button', { name: 'New post' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
};
const closeForm = async (page: Page) => {
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
};

test.describe('the visibility of a new post follows the account', () => {
  for (const privacy of ['private', 'unlisted', 'public']) {
    test(`a default of "${privacy}" is used by the form and sent to the server`, async ({ page }) => {
      const server = newServer({ privacy });
      await open(page, server);
      await openNewPost(page);
      await expect(visibility(page)).toHaveValue(privacy);
      await page.getByRole('dialog').getByRole('textbox', { name: /on your mind/ }).fill('Hello');
      await page.getByRole('dialog').getByRole('button', { name: 'Post', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      expect(server.created![0].body).toMatchObject({ status: 'Hello', visibility: privacy });
    });
  }

  test('when the default cannot be fetched, the form is for followers only and says so, never public', async ({ page }) => {
    const server = newServer({ credentialsFail: true });
    await open(page, server);
    await openNewPost(page);
    await expect(page.getByRole('dialog').getByText('could not be fetched')).toBeVisible();
    await expect(visibility(page)).toHaveValue('private');
    await page.getByRole('dialog').getByRole('textbox', { name: /on your mind/ }).fill('Quiet');
    await page.getByRole('dialog').getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(server.created![0].body).toMatchObject({ visibility: 'private' });
  });

  test('a default that was fetched earlier is kept when the server cannot be reached later', async ({ page }) => {
    const server = newServer({ privacy: 'unlisted' });
    await open(page, server);
    await openNewPost(page);
    await expect(visibility(page)).toHaveValue('unlisted');
    // The stored copy has to be there before the server fails
    await page.waitForTimeout(300);
    await closeForm(page);
    server.credentialsFail = true;
    await openNewPost(page);
    await expect(visibility(page)).toHaveValue('unlisted');
    await expect(page.getByRole('dialog').getByText('could not be fetched')).toHaveCount(0);
  });

  test('a default changed on the server is picked up the next time the form opens', async ({ page }) => {
    const server = newServer({ privacy: 'private' });
    await open(page, server);
    await openNewPost(page);
    await expect(visibility(page)).toHaveValue('private');
    await closeForm(page);
    server.privacy = 'unlisted';
    await openNewPost(page);
    await expect(visibility(page)).toHaveValue('unlisted');
  });

  test('a reply does not make a followers-only account public, nor widen a followers-only post', async ({ page }) => {
    const server = newServer({ privacy: 'private' });
    await open(page, server);
    // Prime the stored default so the reply form starts right
    await openNewPost(page);
    await expect(visibility(page)).toHaveValue('private');
    await closeForm(page);
    await page.getByRole('article').first().getByRole('button', { name: 'Reply' }).click();
    await expect(visibility(page)).toHaveValue('private'); // the post is public, the account is not
    await page.getByRole('dialog').getByRole('textbox', { name: /on your mind/ }).fill('@u thanks');
    await page.getByRole('dialog').getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(server.created![0].body).toMatchObject({ visibility: 'private' });
  });

  test('a private mention needs somebody to be mentioned', async ({ page }) => {
    const server = newServer();
    await open(page, server);
    await openNewPost(page);
    await visibility(page).selectOption('direct');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: /on your mind/ }).fill('Secret');
    await dialog.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Mention someone');
    expect(server.created).toHaveLength(0);
    await dialog.getByRole('textbox', { name: /on your mind/ }).fill('@maija secret');
    await dialog.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(server.created![0].body).toMatchObject({ visibility: 'direct', status: '@maija secret' });
  });

  test('every account has its own default', async ({ page }) => {
    const server = newServer({ privacy: 'public' });
    await open(page, server);
    // Two accounts, each with the default stored at login
    await page.evaluate(async () => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const r = indexedDB.open('keyval-store');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const mk = (id: string, acct: string, defaultPrivacy: string) => ({
        key: `mock.test|${id}`, instance: 'mock.test', clientId: 'c', clientSecret: 's', token: `t${id}`, accountId: id, acct, displayName: acct, avatar: '', defaultPrivacy,
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put([mk('1', 'me', 'private'), mk('9', 'other', 'unlisted')], 'accounts');
        tx.objectStore('keyval').put('mock.test|1', 'active-account');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
    await page.reload();
    await page.waitForSelector('article[data-id]');
    server.credentialsFail = true; // only the stored defaults count
    await openNewPost(page);
    await expect(visibility(page)).toHaveValue('private');
    await closeForm(page);
    await page.getByRole('button', { name: /^Account: @/ }).click();
    await page.getByRole('button', { name: 'Switch to other' }).click();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home' }).click();
    await openNewPost(page);
    await expect(visibility(page)).toHaveValue('unlisted');
  });
});

test.describe('logging out', () => {
  const logout = async (page: Page) => {
    await page.getByRole('button', { name: /^Account: @/ }).click();
    await page.getByRole('button', { name: /^Log out @me/ }).click();
  };
  const loginScreen = (page: Page) => page.getByRole('button', { name: 'Log in' });
  const storedAccounts = (page: Page) =>
    page.evaluate(async () => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const r = indexedDB.open('keyval-store');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const value = await new Promise<unknown[]>((resolve) => {
        const q = db.transaction('keyval').objectStore('keyval').get('accounts');
        q.onsuccess = () => resolve((q.result as unknown[]) ?? []);
      });
      db.close();
      return value.length;
    });

  test('a confirmed revoking says so', async ({ page }) => {
    const server = newServer();
    await open(page, server);
    await logout(page);
    await expect(loginScreen(page)).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'the access was revoked' })).toBeVisible();
    expect(server.revoked).toEqual(['t']);
    expect(await storedAccounts(page)).toBe(0);
  });

  for (const status of ['403', '500'] as const) {
    test(`HTTP ${status} from the server: logged out here, and the reader is told the access may still work`, async ({ page }) => {
      const server = newServer({ revoke: status });
      await open(page, server);
      await logout(page);
      await expect(loginScreen(page)).toBeVisible();
      const alert = page.getByRole('alert').filter({ hasText: 'did not confirm' });
      await expect(alert).toBeVisible();
      await expect(alert).toContainText('Authorized apps on mock.test');
      await expect(page.getByText('Logged out, and the access was revoked')).toHaveCount(0);
      expect(await storedAccounts(page)).toBe(0); // the token is not kept anywhere
    });
  }

  test('offline: logged out here, the failure is reported', async ({ page }) => {
    const server = newServer();
    await open(page, server);
    await page.route('https://mock.test/oauth/revoke', (route) => route.abort('internetdisconnected'));
    await logout(page);
    await expect(loginScreen(page)).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'did not confirm' })).toBeVisible();
    expect(await storedAccounts(page)).toBe(0);
  });

  test('a server that never answers does not hold the local logout, and the revoking is given up on later', async ({ page }) => {
    const server = newServer({ revoke: 'hang' });
    await open(page, server);
    await logout(page);
    await expect(loginScreen(page)).toBeVisible({ timeout: 2000 }); // at once, not after the time limit
    expect(await storedAccounts(page)).toBe(0);
    await expect(page.getByText('Logged out, and the access was revoked')).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: 'did not confirm' })).toBeVisible({ timeout: 15_000 });
  });

  test('two tabs: logging out in one clears the account from the other at once', async ({ browser }) => {
    const context: BrowserContext = await browser.newContext({ baseURL: 'http://localhost:4173', locale: 'en-US', viewport: { width: 420, height: 800 } });
    const a = await context.newPage();
    const b = await context.newPage();
    const server = newServer();
    await open(a, server);
    await mockMastodon(b, server);
    await b.goto('/');
    await b.waitForSelector('article[data-id]');

    await logout(a);
    await expect(loginScreen(a)).toBeVisible();
    await expect(loginScreen(b)).toBeVisible({ timeout: 3000 }); // without a reload
    await context.close();
  });
});

/** A post with a hostile body: every way the report and the usual lists of XSS tricks go */
function evilStatus(i: number, content: string, over: Record<string, unknown> = {}) {
  return {
    id: String(109000000000000000n + BigInt(i)),
    uri: `https://mock.test/s/${i}`,
    url: `https://mock.test/s/${i}`,
    created_at: new Date(Date.UTC(2026, 9, 4, 5, 0, 0) + i * 60_000).toISOString(),
    account: { id: '2', username: 'u', acct: 'u', display_name: 'U', avatar: '', url: 'https://mock.test/@u', emojis: [] },
    content,
    spoiler_text: '',
    sensitive: false,
    visibility: 'public',
    in_reply_to_id: null,
    reblog: null,
    media_attachments: [],
    emojis: [],
    mentions: [],
    replies_count: 0,
    reblogs_count: 0,
    quotes_count: 0,
    favourites_count: 0,
    ...over,
  };
}

test.describe('hostile server data', () => {
  const PAYLOADS = [
    `<p>one <img src="x" onerror="window.__pwned=1"></p>`,
    `<p>two <script>window.__pwned=2</script></p>`,
    `<p>three <a href="javascript:window.__pwned=3">click</a></p>`,
    `<p>four <svg onload="window.__pwned=4"><circle r="1"/></svg></p>`,
    `<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=window.__pwned=5&gt;"></table></mtext></math>`,
    `<p>six <a href="mailto:a@example.org">mail</a> <a href="tel:123">tel</a> <a href="ftp://example.org/x">ftp</a> <a href="data:text/html,<script>window.__pwned=6</script>">data</a></p>`,
    `<p>seven</p><iframe src="https://evil.example/"></iframe><form action="https://evil.example/"><input name="p"></form><object data="x"></object><embed src="x"><base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=https://evil.example/">`,
    `<p>eight <a href="https://ok.example/page" onclick="window.__pwned=8" style="position:fixed;inset:0">ok</a></p>`,
    `<p style="position:fixed;inset:0;z-index:99999">nine overlay</p><div onmouseover="window.__pwned=9">div</div>`,
    `<p>ten <a href="  javascript:window.__pwned=10">a</a> <a href="java&#x09;script:window.__pwned=10">b</a> <a href="&#106;avascript:window.__pwned=10">c</a></p>`,
  ];

  async function openEvil(page: Page) {
    const posts = [
      ...PAYLOADS.map((c, i) => evilStatus(i, c)),
      // The post's own address and the attachment addresses are not web addresses either
      evilStatus(20, '<p>eleven</p>', {
        url: 'javascript:window.__pwned=11',
        uri: 'javascript:window.__pwned=11',
        media_attachments: [
          { id: 'm1', type: 'image', url: 'javascript:window.__pwned=12', preview_url: 'javascript:window.__pwned=12', description: 'bad', meta: { small: { width: 1, height: 1, aspect: 1 } } },
          { id: 'm2', type: 'unknown', url: 'data:text/html,<script>window.__pwned=13</script>', preview_url: '', description: 'bad2' },
        ],
      }),
      // A custom emoji whose address tries to leave the attribute, and a name that is markup
      evilStatus(21, '<p>twelve :evil:</p>', {
        emojis: [{ shortcode: 'evil', url: 'x', static_url: 'https://mock.test/e.png" onerror="window.__pwned=14', visible_in_picker: true }],
        account: { id: '2', username: 'u', acct: 'u', display_name: '<img src=x onerror="window.__pwned=15"> :evil:', avatar: '', url: 'javascript:window.__pwned=16', emojis: [{ shortcode: 'evil', url: 'x', static_url: 'https://mock.test/e.png" onerror="window.__pwned=17', visible_in_picker: true }] },
      }),
    ];
    await mockMastodon(page, newServer());
    await page.route('https://mock.test/api/v1/timelines/home**', (route) => {
      const url = new URL(route.request().url());
      const body = url.searchParams.has('min_id') || url.searchParams.has('max_id') ? [] : posts.slice().reverse();
      return route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Link', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    });
    await seedAccount(page);
    await page.reload();
    await page.waitForSelector('article[data-id]');
    await page.waitForTimeout(500);
  }

  test('nothing runs and nothing dangerous reaches the page', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await openEvil(page);

    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    expect(dialogs).toEqual([]);

    const found = await page.evaluate(() => {
      const root = document.querySelector('.list') ?? document.body;
      // The parts that come from the server: post bodies and display names (the app's own icons are svg, its own elements have styles)
      const served = [...root.querySelectorAll('.content, article header strong, .cw-text')];
      const dangerous = served.flatMap((el) => [...el.querySelectorAll('script, iframe, object, embed, form, input, svg, math, style, base, meta')]);
      const handlers: string[] = [];
      for (const part of served) {
        for (const el of [part, ...part.querySelectorAll('*')]) {
          for (const a of el.getAttributeNames()) if (a.startsWith('on') || a === 'style') handlers.push(`${el.tagName}.${a}`);
        }
      }
      const links = [...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!);
      const sources = [...root.querySelectorAll('[src]')].map((e) => e.getAttribute('src')!).filter((v) => v !== '');
      return { dangerous: dangerous.length, served: served.length, handlers, links, sources };
    });
    expect(found.served).toBeGreaterThan(10); // the posts were really rendered
    expect(found.dangerous).toBe(0);
    expect(found.handlers).toEqual([]);
    // Every link is a web address; nothing else survives (no javascript:, data:, mailto:, tel:, ftp:)
    for (const href of found.links) expect(href, href).toMatch(/^(https?:\/\/|#\/)/);
    for (const src of found.sources) expect(src, src).toMatch(/^(https?:\/\/|data:image\/|blob:)/);
    expect(found.links.some((h) => h.startsWith('https://ok.example/page'))).toBe(true); // a normal link is kept
    expect(requests.some((u) => u.startsWith('https://evil.example'))).toBe(false);
  });

  test('links that stay are opened safely, and a post with a bad address is not a link', async ({ page }) => {
    await openEvil(page);
    const ok = page.locator('.list a[href^="https://ok.example/page"]');
    await expect(ok).toHaveAttribute('target', '_blank');
    await expect(ok).toHaveAttribute('rel', /noopener/);
    await expect(ok).toHaveAttribute('rel', /noreferrer/);
    // The time of the post whose address is javascript: is plain text, not a link
    const eleven = page.locator('article', { hasText: 'eleven' });
    await expect(eleven.locator('.time')).toHaveCount(1);
    expect(await eleven.locator('.time').evaluate((el) => el.tagName)).toBe('SPAN');
    // Its attachments with such addresses are not shown at all
    await expect(eleven.locator('img[src^="javascript"], a[href^="javascript"], a[href^="data"]')).toHaveCount(0);
    // Clicking around does not run anything
    await ok.first().evaluate((el) => el.addEventListener('click', (e) => e.preventDefault()));
    await ok.first().click();
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  });
});

test.describe('new permissions', () => {
  /** The stored account, with the permissions its token was given */
  async function withScopes(page: Page, scopes: string | undefined, server: Server) {
    await open(page, server);
    await page.evaluate(async (value) => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const r = indexedDB.open('keyval-store');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const acc = {
        key: 'mock.test|1', instance: 'mock.test', clientId: 'c', clientSecret: 's', token: 't', accountId: '1', acct: 'me', displayName: 'Me', avatar: '',
        ...(value === undefined ? {} : { scopes: value }),
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put([acc], 'accounts');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, scopes);
    await page.reload();
    await page.waitForSelector('article[data-id]');
  }
  const banner = (page: Page) => page.getByRole('status').filter({ hasText: 'needs new permissions' });

  test('a login with all the permissions is not bothered', async ({ page }) => {
    await withScopes(page, 'read:accounts read:statuses read:notifications read:follows read:bookmarks read:favourites write:favourites write:statuses write:media write:bookmarks write:follows write:conversations push', newServer());
    await expect(banner(page)).toHaveCount(0);
    await withScopes(page, 'read write push', newServer());
    await expect(banner(page)).toHaveCount(0);
  });

  test('a login made before push notifications (or before the permissions were stored) is asked to log in again', async ({ page }) => {
    await withScopes(page, 'read write:favourites write:statuses write:media write:bookmarks write:follows', newServer());
    await expect(banner(page)).toBeVisible();
    await withScopes(page, undefined, newServer());
    await expect(banner(page)).toBeVisible();
  });

  test('a login that lacks a permission the app now wants is asked to log in again, and can say not now', async ({ page }) => {
    await withScopes(page, 'read:accounts read:statuses', newServer());
    await expect(banner(page)).toBeVisible();
    await banner(page).getByRole('button', { name: 'Not now' }).click();
    await expect(banner(page)).toHaveCount(0);
  });

  test('"Log in again" starts the login on the account\'s own server', async ({ page }) => {
    await withScopes(page, 'read:accounts', newServer());
    let authorizeUrl = '';
    await page.route('https://mock.test/api/v1/apps', (route) =>
      route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{"client_id":"n","client_secret":"s"}' }),
    );
    await page.route('https://mock.test/oauth/authorize**', (route) => {
      authorizeUrl = route.request().url();
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<p>authorize</p>' });
    });
    await banner(page).getByRole('button', { name: 'Log in again' }).click();
    await expect.poll(() => authorizeUrl).not.toBe('');
    expect(new URL(authorizeUrl).searchParams.get('scope')).toContain('read:notifications');
  });
});
