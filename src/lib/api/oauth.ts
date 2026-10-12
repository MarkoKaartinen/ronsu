import { get, set } from 'idb-keyval';
import { MastodonClient } from './client';
import { tNow } from '../i18n/runtime';
import { parseDefaultPrivacy } from '../composeLogic';
import type { AccountCredentials, StoredAccount } from './types';

/**
 * Only what the app uses, so a token that leaks can do no more than that (the broad `read` is not asked for):
 * read:accounts (own account, profiles), read:statuses (timeline, threads, reading position), read:notifications,
 * read:follows (the relationship on a profile), and the writes for posting, uploading, favourites, boosts
 * (write:statuses), bookmarks and following.
 */
export const SCOPES =
  'read:accounts read:statuses read:notifications read:follows write:favourites write:statuses write:media write:bookmarks write:follows';
/** What every login asked for before the granted scopes were stored: the scopes of an account without `scopes` */
const LEGACY_SCOPES = 'read write:favourites write:statuses write:media write:bookmarks write:follows';

/**
 * The scopes the app wants that a token does not have. A broad scope covers its narrow ones (`read` covers
 * `read:statuses`), as on Mastodon. An account without a stored list is taken to have the scopes of the first
 * versions, so only a real change of the scopes asks anyone to log in again.
 */
export function missingScopes(granted: string | undefined, required: string = SCOPES): string[] {
  const have = new Set((granted?.trim() || LEGACY_SCOPES).split(/\s+/).filter(Boolean));
  const covered = (scope: string) => {
    const [kind, what] = scope.split(':');
    // `follow` is the old scope for following, blocking and muting, both ways
    return have.has(scope) || have.has(kind) || (have.has('follow') && ['follows', 'blocks', 'mutes'].includes(what));
  };
  return required.split(/\s+/).filter((s) => s && !covered(s));
}
const PENDING_KEY = 'oauth-pending';
/**
 * A login that was started but not finished is forgotten after this long. The state, the verifier and the app
 * secret wait in sessionStorage (this tab only, gone when it closes), not in localStorage.
 */
export const PENDING_TTL_MS = 10 * 60 * 1000;
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
  /** When the login was started (ms), for the time limit */
  startedAt: number;
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
  const pending: PendingLogin = { ...app, instance, verifier, state, redirectUri: redirectUri(), startedAt: Date.now() };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  localStorage.removeItem(PENDING_KEY); // where an older version kept it

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

/** A stored login in progress, or null if it is missing or not what this version wrote */
function parsePending(raw: string | null): PendingLogin | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    const text = (v: unknown) => typeof v === 'string' && v !== '';
    if (text(p?.instance) && text(p.verifier) && text(p.state) && text(p.clientId) && text(p.clientSecret) && text(p.redirectUri) && typeof p.startedAt === 'number') {
      return p as PendingLogin;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/** Handles the return from the server. Returns the account to store. */
export async function finishLogin(): Promise<StoredAccount> {
  const params = new URLSearchParams(location.search);
  // Clean the URL right away so the code is not reused (e.g. on reload)
  history.replaceState(null, '', location.pathname + location.hash);

  // Taken out of storage at once: a callback can be used for one attempt only, whatever its outcome
  const raw = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  localStorage.removeItem(PENDING_KEY);
  const pending = parsePending(raw);
  if (!pending) throw new Error(tNow('login.error.noState'));
  if (Date.now() - pending.startedAt > PENDING_TTL_MS) throw new Error(tNow('login.error.expired'));
  const stateOk = params.get('state') === pending.state;
  if (params.get('error')) {
    // The server's own words only when the answer is really to our request; otherwise anybody could put text in the login screen
    throw new Error(stateOk ? (params.get('error_description') ?? '').slice(0, 200) || tNow('login.error.cancelled') : tNow('login.error.state'));
  }
  const code = params.get('code');
  if (!code || !stateOk) {
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
  const { access_token, scope } = await res.json();
  if (typeof access_token !== 'string' || !access_token) throw new Error(tNow('login.error.token', { status: res.status }));

  const client = new MastodonClient({ instance: pending.instance, token: access_token });
  const me = await client.get<AccountCredentials>('/api/v1/accounts/verify_credentials');

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
    defaultPrivacy: parseDefaultPrivacy(me.source?.privacy) ?? undefined,
    // What the server really gave (it answers with the scopes in the token); what was asked if it does not say
    scopes: typeof scope === 'string' && scope.trim() ? scope.trim() : SCOPES,
  };
}

/** The server did not answer for this long: the revoking is given up on (the local logout does not wait for it) */
const REVOKE_TIMEOUT_MS = 8000;

/** `ok` only when the server answered with a success: anything else means the token may still work */
export type RevokeResult = { ok: true } | { ok: false; reason: 'http' | 'timeout' | 'network'; status?: number };

/** Revokes the token on the server. The answer is checked and a failure is reported, never swallowed. */
export async function revokeToken(acc: StoredAccount, timeoutMs = REVOKE_TIMEOUT_MS): Promise<RevokeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://${acc.instance}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: acc.clientId, client_secret: acc.clientSecret, token: acc.token }),
      signal: controller.signal,
    });
    return res.ok ? { ok: true } : { ok: false, reason: 'http', status: res.status };
  } catch {
    return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
