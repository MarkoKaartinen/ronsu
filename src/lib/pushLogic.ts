/** The notification types Ronsu lists (see Notifications.svelte); each has a push alert of the same name in Mastodon's API */
export const PUSH_TYPES = ['mention', 'quote', 'status', 'reblog', 'favourite', 'follow', 'follow_request', 'poll', 'update'] as const;
export type PushType = (typeof PUSH_TYPES)[number];

/** Whom push notifications come from: Mastodon's `policy` of a push subscription */
export const PUSH_POLICIES = ['all', 'followed', 'follower', 'none'] as const;
export type PushPolicy = (typeof PUSH_POLICIES)[number];

/** Where the preferences are stored (IndexedDB, because the service worker reads them too) */
export const PUSH_PREFS_KEY = 'push-prefs';

/** What this device does with a push; the server-side choices (which types, from whom) live in the subscription */
export interface PushPrefs {
  /** Per type: does the notification make a sound? */
  sound: Record<PushType, boolean>;
  /** A mark on the app icon while there is something unread */
  badge: boolean;
  /** Per account (its key): from whom the push notifications come. Mastodon does not return it, so it is kept here */
  policy: Record<string, PushPolicy>;
}

/** Quiet for the two that come in numbers (favorites and boosts), a sound for the rest */
export function defaultPrefs(): PushPrefs {
  const sound = Object.fromEntries(PUSH_TYPES.map((t) => [t, t !== 'favourite' && t !== 'reblog'])) as Record<PushType, boolean>;
  return { sound, badge: true, policy: {} };
}

/** Reads stored preferences; whatever is missing or malformed falls back to the default */
export function parsePrefs(raw: unknown): PushPrefs {
  const prefs = defaultPrefs();
  if (!raw || typeof raw !== 'object') return prefs;
  const r = raw as Partial<Record<keyof PushPrefs, unknown>>;
  if (r.sound && typeof r.sound === 'object') {
    for (const type of PUSH_TYPES) {
      const v = (r.sound as Record<string, unknown>)[type];
      if (typeof v === 'boolean') prefs.sound[type] = v;
    }
  }
  if (typeof r.badge === 'boolean') prefs.badge = r.badge;
  if (r.policy && typeof r.policy === 'object') {
    for (const [key, v] of Object.entries(r.policy)) {
      if ((PUSH_POLICIES as readonly string[]).includes(v as string)) prefs.policy[key] = v as PushPolicy;
    }
  }
  return prefs;
}

/** All types on, as the first subscription is made (the reader then switches off what they do not want) */
export function allAlerts(): Record<PushType, boolean> {
  return Object.fromEntries(PUSH_TYPES.map((t) => [t, true])) as Record<PushType, boolean>;
}

/** The alerts as the server reports them: a type it does not mention is off */
export function readAlerts(alerts: Record<string, boolean | undefined> | undefined): Record<PushType, boolean> {
  return Object.fromEntries(PUSH_TYPES.map((t) => [t, alerts?.[t] === true])) as Record<PushType, boolean>;
}

/** The VAPID key comes as URL-safe base64; `pushManager.subscribe` wants the bytes */
export function vapidKeyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '=');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** The same two keys? (the browser's subscription, `applicationServerKey`, against the server's) */
export function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

/** Standard base64 of a subscription key, as Mastodon wants it */
export function keyToBase64(key: ArrayBuffer | null): string {
  return key ? btoa(String.fromCharCode(...new Uint8Array(key))) : '';
}
