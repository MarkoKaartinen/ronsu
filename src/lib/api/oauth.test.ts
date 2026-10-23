import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appCacheKey, challengeFor, finishLogin, hasOAuthCallback, missingScopes, normalizeInstance, PENDING_TTL_MS, randomString, revokeToken, SCOPES } from './oauth';
import type { StoredAccount } from './types';

describe('normalizeInstance', () => {
  it('cleans up the address', () => {
    expect(normalizeInstance('https://Mastodon.Social/@foo')).toBe('mastodon.social');
    expect(normalizeInstance('  mastodon.social ')).toBe('mastodon.social');
    expect(normalizeInstance('@marko@mastodon.example')).toBe('mastodon.example');
    expect(normalizeInstance('mas.to/')).toBe('mas.to');
  });

  it('rejects invalid ones', () => {
    expect(() => normalizeInstance('')).toThrow();
    expect(() => normalizeInstance('localhost')).toThrow();
    expect(() => normalizeInstance('foo bar.com')).toThrow();
  });
});

describe('PKCE', () => {
  it('computes the S256 challenge per the RFC 7636 example', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('produces URL-safe random strings', () => {
    const a = randomString(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(randomString(32));
  });
});

describe('appCacheKey', () => {
  it('is per server and redirect URI, and includes the app name so a rename triggers a new registration', () => {
    const key = appCacheKey('mastodon.social', 'https://ronsu.example.org/');
    expect(key).toContain('mastodon.social');
    expect(key).toContain('https://ronsu.example.org/');
    expect(key).toContain('Ronsu');
    expect(key).not.toBe(appCacheKey('mas.to', 'https://ronsu.example.org/'));
    // The old registrations (made under the name "Mastodon-lukija") were stored without the name in the key
    expect(key).not.toBe('app|mastodon.social|https://ronsu.example.org/|' + key.split('|')[3]);
  });
});

describe('scopes', () => {
  it('does not ask for the broad read scope, only the reads the app needs', () => {
    const scopes = SCOPES.split(' ');
    expect(scopes).not.toContain('read');
    expect(scopes).not.toContain('write');
    expect(scopes).not.toContain('follow');
    expect(scopes).toEqual(expect.arrayContaining(['read:accounts', 'read:statuses', 'read:notifications', 'read:follows', 'push']));
    // A change of scopes registers a new app at the next login
    expect(appCacheKey('mas.to', 'https://r.example/')).toContain(SCOPES);
  });
});

describe('missingScopes', () => {
  it('nothing is missing from a login made with the current scopes', () => {
    expect(missingScopes(SCOPES)).toEqual([]);
  });

  it('a broad scope covers its narrow ones, so an older login lacks only the scopes no broad scope covers', () => {
    expect(missingScopes('read write')).toEqual(['push']);
    expect(missingScopes('read write:favourites write:statuses write:media write:bookmarks write:follows')).toEqual(['write:mutes', 'write:blocks', 'write:conversations', 'push']);
    expect(missingScopes('read follow write:favourites write:statuses write:media write:bookmarks')).toEqual(['write:conversations', 'push']);
    expect(missingScopes('read write push')).toEqual([]);
  });

  it('an account without a stored list is taken to have the first versions\' scopes', () => {
    expect(missingScopes(undefined)).toEqual(['write:mutes', 'write:blocks', 'write:conversations', 'push']);
    expect(missingScopes(undefined, `${SCOPES} write:lists`)).toEqual(['write:mutes', 'write:blocks', 'write:conversations', 'push', 'write:lists']);
  });

  it('a login made before the lists of bookmarks and favourites lacks only their two read scopes', () => {
    const before = 'read:accounts read:statuses read:notifications read:follows write:favourites write:statuses write:media write:bookmarks write:follows write:mutes write:blocks write:conversations push';
    expect(missingScopes(before)).toEqual(['read:bookmarks', 'read:favourites']);
  });

  it('a login made before muting and blocking lacks only their two write scopes', () => {
    const before = 'read:accounts read:statuses read:notifications read:follows read:bookmarks read:favourites write:favourites write:statuses write:media write:bookmarks write:follows write:conversations push';
    expect(missingScopes(before)).toEqual(['write:mutes', 'write:blocks']);
  });

  it('lists the scopes a change of the app has added, and only those', () => {
    const wanted = `${SCOPES} write:lists read:lists`;
    expect(missingScopes(SCOPES, wanted)).toEqual(['write:lists', 'read:lists']);
    expect(missingScopes('read:accounts', 'read:accounts read:statuses')).toEqual(['read:statuses']);
    expect(missingScopes('write', 'write:statuses read:statuses')).toEqual(['read:statuses']); // write does not cover read
  });

  it('copes with extra spaces and an empty list', () => {
    expect(missingScopes('  read:accounts   read:statuses ', 'read:accounts  read:statuses')).toEqual([]);
    expect(missingScopes('', 'read:accounts')).toEqual([]); // empty means "not stored": the first versions' scopes
  });
});

/** A browser as far as the login needs it */
function stubBrowser(search: string) {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  const session = store();
  const local = store();
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('location', { search, pathname: '/', hash: '', origin: 'https://ronsu.example' });
  const replaceState = vi.fn();
  vi.stubGlobal('history', { replaceState });
  return { session, local, replaceState };
}

const pending = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ instance: 'mas.to', clientId: 'c', clientSecret: 's', verifier: 'v'.repeat(43), state: 'good-state', redirectUri: 'https://ronsu.example/', startedAt: Date.now(), ...over });

describe('finishLogin', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('recognizes a return from the server', () => {
    stubBrowser('?code=a&state=b');
    expect(hasOAuthCallback()).toBe(true);
    stubBrowser('?error=access_denied');
    expect(hasOAuthCallback()).toBe(true);
    stubBrowser('');
    expect(hasOAuthCallback()).toBe(false);
  });

  it('logs in with the right code, state and PKCE verifier, and keeps the account default privacy', async () => {
    const { session, replaceState } = stubBrowser('?code=the-code&state=good-state');
    session.setItem('oauth-pending', pending());
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'tok', scope: 'read:accounts read:statuses write:statuses' }))
      .mockResolvedValueOnce(json({ id: '7', acct: 'me', username: 'me', display_name: 'Me', avatar: '', source: { privacy: 'private' } }));
    const account = await finishLogin();
    expect(replaceState).toHaveBeenCalled(); // the code is out of the address bar
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ grant_type: 'authorization_code', code: 'the-code', code_verifier: 'v'.repeat(43), scope: SCOPES });
    expect(account).toMatchObject({ key: 'mas.to|7', token: 'tok', defaultPrivacy: 'private', scopes: 'read:accounts read:statuses write:statuses' });
    expect(session.getItem('oauth-pending')).toBeNull();
  });

  it('rejects a wrong state without asking for a token', async () => {
    const { session } = stubBrowser('?code=the-code&state=forged');
    session.setItem('oauth-pending', pending());
    await expect(finishLogin()).rejects.toThrow('verification failed');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(session.getItem('oauth-pending')).toBeNull(); // and the attempt is used up
  });

  it('rejects a missing state and a missing code', async () => {
    let b = stubBrowser('?code=the-code');
    b.session.setItem('oauth-pending', pending());
    await expect(finishLogin()).rejects.toThrow('verification failed');
    b = stubBrowser('?state=good-state');
    b.session.setItem('oauth-pending', pending());
    await expect(finishLogin()).rejects.toThrow('verification failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a callback when no login was started (a reused or planted link)', async () => {
    stubBrowser('?code=the-code&state=good-state');
    await expect(finishLogin()).rejects.toThrow('state is missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cannot be used twice: the second return of the same callback finds nothing', async () => {
    const { session } = stubBrowser('?code=the-code&state=good-state');
    session.setItem('oauth-pending', pending());
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'tok' }))
      .mockResolvedValueOnce(json({ id: '7', acct: 'me', username: 'me', display_name: '', avatar: '' }));
    await finishLogin();
    await expect(finishLogin()).rejects.toThrow('state is missing');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('forgets a login that was started too long ago', async () => {
    const { session } = stubBrowser('?code=the-code&state=good-state');
    session.setItem('oauth-pending', pending({ startedAt: Date.now() - PENDING_TTL_MS - 1000 }));
    await expect(finishLogin()).rejects.toThrow('too long');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores a pending login in the old place and one that is damaged', async () => {
    const { local, session } = stubBrowser('?code=the-code&state=good-state');
    local.setItem('oauth-pending', pending());
    await expect(finishLogin()).rejects.toThrow('state is missing');
    session.setItem('oauth-pending', '{"state": "good-state"');
    await expect(finishLogin()).rejects.toThrow('state is missing');
    session.setItem('oauth-pending', JSON.stringify({ state: 'good-state' }));
    await expect(finishLogin()).rejects.toThrow('state is missing');
    expect(local.getItem('oauth-pending')).toBeNull(); // the old copy is gone too
  });

  it('shows the server\'s own error text only when the state matches', async () => {
    let b = stubBrowser('?error=access_denied&error_description=No+thanks&state=good-state');
    b.session.setItem('oauth-pending', pending());
    await expect(finishLogin()).rejects.toThrow('No thanks');
    b = stubBrowser('?error=access_denied&error_description=Call+this+number&state=forged');
    b.session.setItem('oauth-pending', pending());
    await expect(finishLogin()).rejects.toThrow('verification failed');
    b = stubBrowser('?error=access_denied&state=good-state');
    b.session.setItem('oauth-pending', pending());
    await expect(finishLogin()).rejects.toThrow('cancelled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a failing token request and a token that is not there', async () => {
    let b = stubBrowser('?code=c&state=good-state');
    b.session.setItem('oauth-pending', pending());
    fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant' }, 400));
    await expect(finishLogin()).rejects.toThrow('(400)');
    b = stubBrowser('?code=c&state=good-state');
    b.session.setItem('oauth-pending', pending());
    fetchMock.mockResolvedValueOnce(json({}));
    await expect(finishLogin()).rejects.toThrow('Fetching the access token failed');
  });
});

describe('revokeToken', () => {
  const acc = { instance: 'mas.to', clientId: 'c', clientSecret: 's', token: 't' } as StoredAccount;
  afterEach(() => vi.unstubAllGlobals());

  it('is ok only when the server says so', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(await revokeToken(acc)).toEqual({ ok: true });
  });

  it('reports an HTTP error instead of hiding it', async () => {
    for (const status of [403, 500]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
      expect(await revokeToken(acc)).toEqual({ ok: false, reason: 'http', status });
    }
  });

  it('reports being offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await revokeToken(acc)).toEqual({ ok: false, reason: 'network' });
  });

  it('gives up on a server that does not answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))),
    );
    expect(await revokeToken(acc, 20)).toEqual({ ok: false, reason: 'timeout' });
  });
});
