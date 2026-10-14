import { expect, test, type Page } from '@playwright/test';
import { mockMastodon, seedAccount, type Server } from './mock';

/** Chrome cannot reach a push service from a test, so the browser's push manager is replaced by one that answers locally */
async function fakePushManager(page: Page) {
  await page.addInitScript(() => {
    let current: unknown = null;
    const fake = {
      getSubscription: async () => current,
      subscribe: async (options: { applicationServerKey: Uint8Array }) => {
        const key = new Uint8Array(options.applicationServerKey);
        current = {
          endpoint: 'https://push.mock.test/abc',
          options: { applicationServerKey: key.buffer },
          getKey: (name: string) => new Uint8Array([name === 'auth' ? 7 : 9, 255]).buffer,
          unsubscribe: async () => ((current = null), true),
        };
        return current;
      },
    };
    Object.defineProperty(ServiceWorkerRegistration.prototype, 'pushManager', { get: () => fake });
  });
}

async function open(page: Page, server: Partial<Server> = {}, scopes?: string) {
  const full: Server = { marker: null, posts: [], ...server };
  await fakePushManager(page);
  await mockMastodon(page, full);
  await seedAccount(page, scopes);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  return full;
}

const openSettings = (page: Page) => page.getByTitle('Account and settings').click();
const bellDot = (page: Page) => page.locator('.bar .dot');
const storedPrefs = (page: Page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.open('keyval-store');
        r.onsuccess = () => {
          const g = r.result.transaction('keyval').objectStore('keyval').get('push-prefs');
          g.onsuccess = () => resolve(g.result);
        };
      }),
  ) as Promise<{ sound: Record<string, boolean>; badge: boolean }>;

test.describe('the push settings', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['notifications'], { origin: 'http://localhost:4173' });
  });

  test('switching push on subscribes the browser and the server; a type is switched on the server, a sound on this device', async ({ page }) => {
    const server = await open(page);
    await openSettings(page);
    const main = page.getByRole('switch', { name: 'Push notifications on this device' });
    await expect(main).not.toBeChecked();
    await main.check();
    await expect(main).toBeChecked();

    await expect.poll(() => server.pushCalls?.some((c) => c.method === 'POST')).toBe(true);
    const created = server.pushCalls!.find((c) => c.method === 'POST')!;
    expect(created.body.subscription).toMatchObject({ endpoint: 'https://push.mock.test/abc', standard: true });
    expect(created.body.subscription.keys.p256dh).toBe('Cf8='); // the keys as standard base64
    expect(created.body.subscription.keys.auth).toBe('B/8=');
    expect(Object.values(created.body.data.alerts).every(Boolean)).toBe(true);
    expect(Object.keys(created.body.data.alerts)).toHaveLength(9);

    // A type: the server stops sending it
    await page.getByRole('switch', { name: 'Favorites: Notify' }).uncheck();
    await expect.poll(() => server.push?.alerts.favourite).toBe(false);
    expect(server.push?.alerts.mention).toBe(true);
    // Its sound can no longer be chosen
    await expect(page.getByRole('switch', { name: 'Favorites: Sound' })).toBeDisabled();

    // A sound: only this device remembers it (the service worker reads it from there)
    await expect(page.getByRole('switch', { name: 'Mentions: Sound' })).toBeChecked();
    await page.getByRole('switch', { name: 'Mentions: Sound' }).uncheck();
    await expect.poll(async () => (await storedPrefs(page)).sound.mention).toBe(false);
    expect(server.pushCalls!.filter((c) => c.method === 'PUT')).toHaveLength(1); // the sound did not touch the server

    // Off: the server drops the subscription
    await main.uncheck();
    await expect.poll(() => server.push).toBeNull();
    await expect(page.getByRole('switch', { name: 'Mentions: Sound' })).toHaveCount(0);
  });

  test('whom the notifications come from is sent to the server and remembered', async ({ page }) => {
    const server = await open(page);
    await openSettings(page);
    await page.getByRole('switch', { name: 'Push notifications on this device' }).check();
    await page.getByRole('combobox', { name: 'Notifications from' }).selectOption('followed');
    await expect.poll(() => server.pushCalls!.filter((c) => c.method === 'PUT').length).toBe(1);
    expect(server.pushCalls!.find((c) => c.method === 'PUT')!.body.data.policy).toBe('followed');
    await expect.poll(async () => ((await storedPrefs(page)) as unknown as { policy: Record<string, string> }).policy['mock.test|1']).toBe('followed');
  });

  test('a server that is already subscribed shows its choices', async ({ page }) => {
    const server = await open(page, { push: { endpoint: 'https://push.mock.test/abc', alerts: { mention: true, favourite: false } } });
    // The browser has no subscription of its own after a reload, so it is shown off until switched on again
    await openSettings(page);
    await expect(page.getByRole('switch', { name: 'Push notifications on this device' })).not.toBeChecked();
    await page.getByRole('switch', { name: 'Push notifications on this device' }).check();
    await expect.poll(() => server.push?.alerts.mention).toBe(true);
  });

  test('the test button has the service worker show a notification', async ({ page, context }) => {
    await open(page);
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    // What the worker is asked to show is recorded (the operating system's notifications are shared between browsers, so they cannot be counted)
    await worker.evaluate(() => {
      const shown: string[] = [];
      const registration = (self as unknown as { registration: ServiceWorkerRegistration }).registration;
      const original = registration.showNotification.bind(registration);
      registration.showNotification = (title, options) => (shown.push(`${title}: ${options?.body}`), original(title, options));
      (self as unknown as { shown: string[] }).shown = shown;
    });
    await openSettings(page);
    await page.getByRole('switch', { name: 'Push notifications on this device' }).check();
    await page.getByRole('button', { name: 'Send a test notification' }).click();
    await expect.poll(() => worker.evaluate(() => (self as unknown as { shown: string[] }).shown)).toEqual(['Ronsu: Notifications work.']);
  });

  test('a server without a VAPID key says it cannot', async ({ page }) => {
    await open(page, { vapid: false });
    await openSettings(page);
    await expect(page.getByText('does not send push notifications to browsers')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Push notifications on this device' })).toHaveCount(0);
  });

  test('a login without the push permission is asked to log in again', async ({ page }) => {
    await open(page, {}, 'read:accounts read:statuses read:notifications');
    await openSettings(page);
    await expect(page.getByText('Push notifications need a new permission')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Push notifications on this device' })).toHaveCount(0);
  });
});

test.describe('something new in the notifications', () => {
  const marker = (id: string) => ({ last_read_id: id, version: 1, updated_at: '2026-10-04T08:00:00.000Z' });
  const arrives = (page: Page, notificationType = 'mention') =>
    page.evaluate((type) => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'ronsu-push', notificationType: type, play: false } })), notificationType);

  test('a red ball on the bell, and a mark in the title, while the newest is beyond what has been seen; opening them clears it', async ({ page }) => {
    const server = await open(page, { notifications: 1005, notifMarker: marker('1000') });
    await expect(bellDot(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /Notifications, new/ })).toBeVisible();
    await expect(page).toHaveTitle('(•) Ronsu');

    await page.getByRole('button', { name: /Notifications/ }).click();
    await expect.poll(() => server.notifPosts).toEqual(['1005']); // the marker moved: other devices know too
    await expect(bellDot(page)).toHaveCount(0);
    await expect(page).toHaveTitle('Ronsu');
  });

  test('nothing is shown when the marker is up to date', async ({ page }) => {
    await open(page, { notifications: 1005, notifMarker: marker('1005') });
    await page.waitForTimeout(500);
    await expect(bellDot(page)).toHaveCount(0);
    await expect(page).toHaveTitle('Ronsu');
  });

  test('a push that arrives while the app is open brings the ball', async ({ page }) => {
    const server = await open(page, { notifications: 1005, notifMarker: marker('1005') });
    await expect(bellDot(page)).toHaveCount(0);
    server.notifications = 1006;
    await arrives(page);
    await expect(bellDot(page)).toBeVisible();
  });

  test('a push while the notifications are open adds it to the list and marks it seen', async ({ page }) => {
    const server = await open(page, { notifications: 1005, notifMarker: marker('1000') });
    await page.getByRole('button', { name: /Notifications/ }).click();
    await expect(page.locator('.notifs article[data-id]')).toHaveCount(1);
    await expect.poll(() => server.notifPosts).toEqual(['1005']);

    server.notifications = 1006;
    await arrives(page);
    await expect.poll(() => server.notifPosts).toEqual(['1005', '1006']);
    await expect(bellDot(page)).toHaveCount(0);
  });

  test('a click on a notification opens the notifications', async ({ page }) => {
    await open(page);
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'ronsu-open-notifications' } })));
    await expect(page).toHaveURL(/#\/notifications$/);
    await expect(page.locator('.notifs')).toBeVisible();
  });

  test('on a wide screen the notifications are in view, so they are seen at once', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    const server = await open(page, { notifications: 1005, notifMarker: marker('1000') });
    await expect.poll(() => server.notifPosts).toEqual(['1005']);
    await expect(page).toHaveTitle('Ronsu');
  });
});
