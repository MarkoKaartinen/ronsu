// Push notifications. Loaded into the generated service worker (workbox.importScripts in vite.config.ts), so it
// is plain JavaScript and cannot import from src/. Messages to and from the page are described in
// src/lib/stores/push.svelte.ts.

/** The device's preferences (src/lib/pushLogic.ts), in the same IndexedDB the app keeps its accounts in (idb-keyval) */
const PREFS_DB = 'keyval-store';
const PREFS_STORE = 'keyval';
const PREFS_KEY = 'push-prefs';

function readPrefs() {
  return new Promise((resolve) => {
    const open = indexedDB.open(PREFS_DB);
    // Opened here before the app ever was: create the store the way idb-keyval does, or it would find none later
    open.onupgradeneeded = () => open.result.createObjectStore(PREFS_STORE);
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const db = open.result;
      try {
        const get = db.transaction(PREFS_STORE).objectStore(PREFS_STORE).get(PREFS_KEY);
        get.onsuccess = () => {
          db.close();
          resolve(get.result ?? null);
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
}

/** Mastodon's push payload: title, body (the post's text), icon (the avatar) and the type of the notification */
function parsePayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return {};
  }
}

function show(title, options, type, prefs) {
  return self.registration.showNotification(title, {
    ...options,
    // The sound is the system's; all a page can choose is whether this notification makes one
    silent: prefs?.sound?.[type] === false,
    data: { type },
  });
}

async function onPush(event) {
  const payload = parsePayload(event);
  const type = payload.notification_type;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  // Every open window learns of it (to update its list and its mark); only the one in use makes the sound itself
  for (const w of windows) w.postMessage({ type: 'ronsu-push', notificationType: type, play: w.focused });
  // Someone is looking at the app: it shows the news itself
  if (windows.some((w) => w.focused)) return;

  const prefs = await readPrefs();
  await show(
    payload.title || 'Ronsu',
    { body: payload.body, icon: payload.icon, tag: `ronsu-${payload.notification_id}`, lang: payload.preferred_locale },
    type,
    prefs,
  );
  // A mark on the app icon; the app clears it when the notifications have been seen
  if (prefs?.badge !== false && self.navigator.setAppBadge) await self.navigator.setAppBadge().catch(() => {});
}

self.addEventListener('push', (event) => event.waitUntil(onPush(event)));

// The test button in the settings: the same path as a real push, except that it is shown even to a focused window
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'ronsu-test') return;
  event.waitUntil(readPrefs().then((prefs) => show(event.data.title, { body: event.data.body, icon: '/icon-192.png', tag: 'ronsu-test' }, 'mention', prefs)));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => w.focused) || windows.find((w) => w.visibilityState === 'visible') || windows[0];
      if (open) {
        await open.focus();
        open.postMessage({ type: 'ronsu-open-notifications' });
      } else {
        await self.clients.openWindow('/#/notifications');
      }
    })(),
  );
});
