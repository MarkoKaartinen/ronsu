import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

type Handler = (event: unknown) => void;

/** Runs static/push-sw.js against a stand-in for the service worker's global scope */
function load(opts: { prefs?: unknown; windows?: { focused: boolean; visibilityState?: string }[]; badge?: boolean } = {}) {
  const handlers: Record<string, Handler> = {};
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const sent: unknown[][] = [];
  const windows = (opts.windows ?? []).map((w) => ({
    ...w,
    visibilityState: w.visibilityState ?? 'visible',
    postMessage: vi.fn((m: unknown) => sent.push([w, m])),
    focus: vi.fn().mockResolvedValue(undefined),
  }));
  const setAppBadge = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const self = {
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    registration: { showNotification: vi.fn(async (title: string, options: Record<string, unknown>) => void shown.push({ title, options })) },
    clients: { matchAll: vi.fn().mockResolvedValue(windows), openWindow },
    navigator: opts.badge === false ? {} : { setAppBadge },
  };
  // A key-value store with the one key the worker reads
  const indexedDB = {
    open: () => {
      const req: Record<string, unknown> = {};
      const db = {
        close: () => {},
        transaction: () => ({
          objectStore: () => ({
            get: () => {
              const get: Record<string, unknown> = {};
              queueMicrotask(() => {
                get.result = opts.prefs;
                (get.onsuccess as () => void)();
              });
              return get;
            },
          }),
        }),
      };
      queueMicrotask(() => {
        req.result = db;
        (req.onsuccess as () => void)();
      });
      return req;
    },
  };
  new Function('self', 'indexedDB', readFileSync('static/push-sw.js', 'utf8'))(self, indexedDB);
  const push = async (payload: unknown) => {
    const waits: Promise<unknown>[] = [];
    handlers.push({ data: { json: () => payload }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  return { handlers, shown, sent, windows, setAppBadge, openWindow, push, self };
}

const mention = { notification_type: 'mention', notification_id: '7', title: 'Someone mentioned you', body: 'Hello', icon: 'https://mock.test/a.png', preferred_locale: 'fi' };

describe('a push while the app is not in use', () => {
  it('shows a notification from the payload, with the sound of the system', async () => {
    const sw = load({ prefs: { sound: { mention: true }, badge: true } });
    await sw.push(mention);
    expect(sw.shown).toHaveLength(1);
    expect(sw.shown[0].title).toBe('Someone mentioned you');
    expect(sw.shown[0].options).toMatchObject({ body: 'Hello', icon: 'https://mock.test/a.png', tag: 'ronsu-7', lang: 'fi', silent: false });
  });

  it('is silent for a type whose sound is off, and loud for one whose sound is on', async () => {
    const sw = load({ prefs: { sound: { favourite: false, mention: true } } });
    await sw.push({ ...mention, notification_type: 'favourite' });
    await sw.push(mention);
    expect(sw.shown.map((s) => s.options.silent)).toEqual([true, false]);
  });

  it('is not silent when no preferences have been stored', async () => {
    const sw = load({ prefs: undefined });
    await sw.push(mention);
    expect(sw.shown[0].options.silent).toBe(false);
  });

  it('puts a mark on the app icon, unless that is switched off or not supported', async () => {
    const on = load({ prefs: { badge: true } });
    await on.push(mention);
    expect(on.setAppBadge).toHaveBeenCalled();
    const off = load({ prefs: { badge: false } });
    await off.push(mention);
    expect(off.setAppBadge).not.toHaveBeenCalled();
    const none = load({ prefs: { badge: true }, badge: false });
    await none.push(mention);
    expect(none.shown).toHaveLength(1);
  });

  it('copes with a payload that is not JSON', async () => {
    const sw = load({});
    const waits: Promise<unknown>[] = [];
    sw.handlers.push({ data: { json: () => { throw new Error('x'); } }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(sw.shown[0].title).toBe('Ronsu');
  });
});

describe('a push while the app is in use', () => {
  it('shows nothing; the focused window is told to make the sound, the others only to update', async () => {
    const sw = load({ windows: [{ focused: true }, { focused: false, visibilityState: 'hidden' }] });
    await sw.push(mention);
    expect(sw.shown).toHaveLength(0);
    expect(sw.setAppBadge).not.toHaveBeenCalled();
    expect(sw.windows[0].postMessage).toHaveBeenCalledWith({ type: 'ronsu-push', notificationType: 'mention', play: true });
    expect(sw.windows[1].postMessage).toHaveBeenCalledWith({ type: 'ronsu-push', notificationType: 'mention', play: false });
  });

  it('shows a notification when the window is open but not the one in use, and still tells it', async () => {
    const sw = load({ windows: [{ focused: false }] });
    await sw.push(mention);
    expect(sw.shown).toHaveLength(1);
    expect(sw.windows[0].postMessage).toHaveBeenCalledWith({ type: 'ronsu-push', notificationType: 'mention', play: false });
  });
});

describe('the test notification', () => {
  it('is shown even to a focused window, with the sound of a mention', async () => {
    const sw = load({ prefs: { sound: { mention: false } }, windows: [{ focused: true }] });
    const waits: Promise<unknown>[] = [];
    sw.handlers.message({ data: { type: 'ronsu-test', title: 'Test', body: 'Works' }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(sw.shown[0].title).toBe('Test');
    expect(sw.shown[0].options).toMatchObject({ body: 'Works', silent: true });
  });

  it('ignores other messages', () => {
    const sw = load({});
    sw.handlers.message({ data: { type: 'something' }, waitUntil: () => {} });
    expect(sw.shown).toHaveLength(0);
  });
});

describe('a click on the notification', () => {
  const click = async (sw: ReturnType<typeof load>) => {
    const close = vi.fn();
    const waits: Promise<unknown>[] = [];
    sw.handlers.notificationclick({ notification: { close }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    return close;
  };

  it('focuses the open window and asks it to show the notifications', async () => {
    const sw = load({ windows: [{ focused: false, visibilityState: 'hidden' }, { focused: false, visibilityState: 'visible' }] });
    const close = await click(sw);
    expect(close).toHaveBeenCalled();
    expect(sw.windows[1].focus).toHaveBeenCalled();
    expect(sw.windows[1].postMessage).toHaveBeenCalledWith({ type: 'ronsu-open-notifications' });
    expect(sw.openWindow).not.toHaveBeenCalled();
  });

  it('opens the app on the notifications when it is not open', async () => {
    const sw = load({ windows: [] });
    await click(sw);
    expect(sw.openWindow).toHaveBeenCalledWith('/#/notifications');
  });
});
