import { describe, expect, it } from 'vitest';
import { appCacheKey, challengeFor, normalizeInstance, randomString } from './oauth';

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
