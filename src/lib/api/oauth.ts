import { get, set } from 'idb-keyval';
import { MastodonClient } from './client';
import { tNow } from '../i18n/runtime';
import type { Account, StoredAccount } from './types';

const SCOPES = 'read write:favourites write:statuses write:media write:bookmarks write:follows';
const PENDING_KEY = 'oauth-pending';
/** The name shown to the user and on every post made with the app (Mastodon's `application` field) */
const CLIENT_NAME = 'Ronsu';

interface RegisteredApp {
  clientId: string;
  clientSecret: string;
}

interface PendingLogin extends RegisteredApp {
  instance: string;
  verifier: string;
  state: string;
  redirectUri: string;
}

export function redirectUri(): string {
  return `${location.origin}/`;
}

/** "https://Mastodon.social/@foo" -> "mastodon.social" */
export function normalizeInstance(input: string): string {
  let v = input.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, '');
  v = v.split(/[/?#]/)[0];
  if (v.startsWith('@')) v = v.slice(1);
  // "@user@instance" -> instance
  if (v.includes('@')) v = v.split('@').pop()!;
  if (!/^[a-z0-9.-]+(:\d+)?$/.test(v) || !v.includes('.')) {
    throw new Error(tNow('login.error.server'));
  }
  return v;
}

function base64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomString(byteLength = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/**
 * Key of the stored app registration. The scopes and the app name are part of it: when either changes, a new
 * app is registered on the server at the next login (the name is what other people see on the posts).
 */
export function appCacheKey(instance: string, redirect: string): string {
  return `app|${instance}|${redirect}|${SCOPES}|${CLIENT_NAME}`;
}

/** Registers the app on the server (once per server + redirect URI), or reuses the stored registration. */
async function ensureApp(instance: string): Promise<RegisteredApp> {
  const cacheKey = appCacheKey(instance, redirectUri());
  const cached = await get<RegisteredApp>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`https://${instance}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      redirect_uris: redirectUri(),
      scopes: SCOPES,
      website: location.origin,
    }),
  });
  if (!res.ok) throw new Error(tNow('login.error.register', { status: res.status }));
  const json = await res.json();
  const app: RegisteredApp = { clientId: json.client_id, clientSecret: json.client_secret };
  await set(cacheKey, app);
  return app;
}

/** Starts the login: sends the browser to the server's authorization page. */
export async function startLogin(instanceInput: string): Promise<void> {
  const instance = normalizeInstance(instanceInput);
  const app = await ensureApp(instance);
  const verifier = randomString(48);
  const state = randomString(16);
  const pending: PendingLogin = { ...app, instance, verifier, state, redirectUri: redirectUri() };
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const url = new URL(`https://${instance}/oauth/authorize`);
  url.search = new URLSearchParams({
    client_id: app.clientId,
    response_type: 'code',
    redirect_uri: pending.redirectUri,
    scope: SCOPES,
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
    // Allow adding a second account: the server asks which account to use again
    force_login: 'true',
  }).toString();
  location.assign(url.toString());
}

export function hasOAuthCallback(): boolean {
  const p = new URLSearchParams(location.search);
  return p.has('code') || p.has('error');
}

/** Handles the return from the server. Returns the account to store. */
export async function finishLogin(): Promise<StoredAccount> {
  const params = new URLSearchParams(location.search);
  // Clean the URL right away so the code is not reused (e.g. on reload)
  history.replaceState(null, '', location.pathname + location.hash);

  const raw = localStorage.getItem(PENDING_KEY);
  localStorage.removeItem(PENDING_KEY);
  if (params.get('error')) {
    throw new Error(params.get('error_description') ?? tNow('login.error.cancelled'));
  }
  if (!raw) throw new Error(tNow('login.error.noState'));
  const pending = JSON.parse(raw) as PendingLogin;
  const code = params.get('code');
  if (!code || params.get('state') !== pending.state) {
    throw new Error(tNow('login.error.state'));
  }

  const res = await fetch(`https://${pending.instance}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: pending.clientId,
      client_secret: pending.clientSecret,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier,
      scope: SCOPES,
    }),
  });
  if (!res.ok) throw new Error(tNow('login.error.token', { status: res.status }));
  const { access_token } = await res.json();

  const client = new MastodonClient({ instance: pending.instance, token: access_token });
  const me = await client.get<Account>('/api/v1/accounts/verify_credentials');

  return {
    key: `${pending.instance}|${me.id}`,
    instance: pending.instance,
    clientId: pending.clientId,
    clientSecret: pending.clientSecret,
    token: access_token,
    accountId: me.id,
    acct: me.acct,
    displayName: me.display_name || me.username,
    avatar: me.avatar,
  };
}

/** Revokes the token on the server (errors are ignored: the account is removed locally either way). */
export async function revokeToken(acc: StoredAccount): Promise<void> {
  try {
    await fetch(`https://${acc.instance}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: acc.clientId, client_secret: acc.clientSecret, token: acc.token }),
    });
  } catch {
    /* offline etc. */
  }
}
