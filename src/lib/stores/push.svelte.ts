import { get, set } from 'idb-keyval';
import type { MastodonClient } from '../api/client';
import {
  createPushSubscription,
  deletePushSubscription,
  getPushSubscription,
  getVapidKey,
  updatePushSubscription,
} from '../api/push';
import {
  allAlerts,
  defaultPrefs,
  keyToBase64,
  parsePrefs,
  PUSH_PREFS_KEY,
  readAlerts,
  sameKey,
  vapidKeyBytes,
  type PushPolicy,
  type PushPrefs,
  type PushType,
} from '../pushLogic';
import { router } from '../router.svelte';

/**
 * Push notifications of this device. The server decides what is sent (a subscription per login: which types, and
 * from whom); this device decides what a notification does when it arrives (a sound or not, a mark on the icon).
 * The service worker (static/push-sw.js) shows them, and tells the open page of them with these messages:
 *   ronsu-push { notificationType, play }  a push arrived: update, and make the sound if `play`
 *   ronsu-open-notifications               a notification was clicked
 * and the page asks it for a test notification with { type: 'ronsu-test', title, body }.
 */

/** off: no subscription (or one that is not this browser's); on: pushes arrive; unavailable: the server cannot send web push */
export type PushStatus = 'unknown' | 'off' | 'on' | 'unavailable';

const supported =
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;

class PushStore {
  readonly supported = supported;
  prefs = $state<PushPrefs>(defaultPrefs());
  permission = $state<NotificationPermission>(supported ? Notification.permission : 'denied');
  status = $state<PushStatus>('unknown');
  /** The types the server sends for this login */
  alerts = $state(allAlerts());
  busy = $state(false);
  error = $state('');
  /** Counts the pushes that arrived while the app was open: whoever shows the notifications updates when it changes */
  signal = $state(0);
  private audio: AudioContext | undefined;

  /** Reads the preferences and starts listening to the service worker; once, when the app starts */
  async init() {
    try {
      this.prefs = parsePrefs(await get(PUSH_PREFS_KEY));
    } catch {
      /* no storage: the defaults */
    }
    if (!supported) return;
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
      const d = e.data;
      if (d?.type === 'ronsu-push') {
        if (d.play && this.prefs.sound[d.notificationType as PushType]) this.chime();
        this.signal++;
      } else if (d?.type === 'ronsu-open-notifications') {
        router.openTab('notifications');
      }
    });
  }

  private async savePrefs() {
    try {
      await set(PUSH_PREFS_KEY, $state.snapshot(this.prefs));
    } catch {
      /* no storage: the choice lasts until the page is closed */
    }
  }

  setSound(type: PushType, on: boolean) {
    this.prefs.sound[type] = on;
    void this.savePrefs();
  }

  setBadge(on: boolean) {
    this.prefs.badge = on;
    void this.savePrefs();
  }

  policy(accountKey: string): PushPolicy {
    return this.prefs.policy[accountKey] ?? 'all';
  }

  /** Finds out whether this login has a working subscription in this browser (the settings call it when they open) */
  async load(client: MastodonClient) {
    this.error = '';
    if (!supported) return;
    this.permission = Notification.permission;
    try {
      const [server, vapid, registration] = await Promise.all([getPushSubscription(client), getVapidKey(client), navigator.serviceWorker.ready]);
      if (!vapid) {
        this.status = 'unavailable';
        return;
      }
      const browser = await registration.pushManager.getSubscription();
      // Only a subscription the server knows by this very endpoint, made with this server's key, is one that works
      const works = !!server && !!browser && browser.endpoint === server.endpoint && sameKey(browser.options.applicationServerKey, vapidKeyBytes(vapid));
      this.status = works ? 'on' : 'off';
      if (server) this.alerts = readAlerts(server.alerts);
    } catch (e) {
      this.status = 'off';
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  /** Asks for the permission, subscribes this browser, and tells the server where to send */
  async enable(client: MastodonClient, accountKey: string) {
    this.error = '';
    this.busy = true;
    try {
      this.permission = await Notification.requestPermission();
      if (this.permission !== 'granted') return;
      const vapid = await getVapidKey(client);
      if (!vapid) {
        this.status = 'unavailable';
        return;
      }
      const key = vapidKeyBytes(vapid);
      const registration = await navigator.serviceWorker.ready;
      let browser = await registration.pushManager.getSubscription();
      // A browser subscription belongs to one server key: another server's has to make way for this one
      if (browser && !sameKey(browser.options.applicationServerKey, key)) {
        await browser.unsubscribe();
        browser = null;
      }
      browser ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const created = await createPushSubscription(
        client,
        { endpoint: browser.endpoint, p256dh: keyToBase64(browser.getKey('p256dh')), auth: keyToBase64(browser.getKey('auth')) },
        allAlerts(),
        this.policy(accountKey),
      );
      this.alerts = readAlerts(created.alerts);
      this.status = 'on';
      await this.savePrefs(); // so that the service worker finds the preferences, even if nothing was changed
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.busy = false;
    }
  }

  /** Stops the server sending to this login. The browser's subscription stays: other logins on the same server share it. */
  async disable(client: MastodonClient) {
    this.error = '';
    this.busy = true;
    try {
      await deletePushSubscription(client);
      this.status = 'off';
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.busy = false;
    }
  }

  /** Switches a type on or off on the server */
  async setAlert(client: MastodonClient, accountKey: string, type: PushType, on: boolean) {
    const before = { ...this.alerts };
    this.alerts[type] = on;
    await this.sync(client, accountKey, before);
  }

  async setPolicy(client: MastodonClient, accountKey: string, policy: PushPolicy) {
    const before = this.prefs.policy[accountKey];
    this.prefs.policy[accountKey] = policy;
    await this.sync(client, accountKey, { ...this.alerts }, () => {
      if (before) this.prefs.policy[accountKey] = before;
      else delete this.prefs.policy[accountKey];
    });
    void this.savePrefs();
  }

  private async sync(client: MastodonClient, accountKey: string, before: Record<PushType, boolean>, undo?: () => void) {
    this.error = '';
    try {
      this.alerts = readAlerts((await updatePushSubscription(client, $state.snapshot(this.alerts), this.policy(accountKey))).alerts);
    } catch (e) {
      this.alerts = before;
      undo?.();
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  /** The service worker shows a notification as it would for a push: to see that the permission, the sound and the click work */
  async test(title: string, body: string) {
    this.error = '';
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({ type: 'ronsu-test', title, body });
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  /** The sound for a notification that arrives while the app is open: two soft notes, made here so there is no file to load */
  private chime() {
    try {
      const ctx = (this.audio ??= new AudioContext());
      void ctx.resume();
      const now = ctx.currentTime;
      [660, 880].forEach((hz, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.15, now + i * 0.14 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.18);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.2);
      });
    } catch {
      /* the browser does not let the page make a sound yet (nothing has been tapped): the notification still shows */
    }
  }
}

export const push = new PushStore();
