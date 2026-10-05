import { expect, test, type Page } from '@playwright/test';
import { mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Page, server: Server = { marker: null, posts: [] }) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

const columns = (page: Page) =>
  page.evaluate(() => {
    const lefts = new Set(
      [...document.querySelectorAll<HTMLElement>('.list > article[data-id]')].slice(0, 12).map((a) => Math.round(a.getBoundingClientRect().left)),
    );
    return lefts.size;
  });

// The reading view is always a single column, also on tablets and desktops
for (const [name, width] of [['phone', 420], ['tablet', 820], ['desktop', 1366]] as const) {
  test(`${name} (${width}px): a single column, no horizontal scrolling, top-to-bottom order`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    expect(await columns(page)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // DOM order = reading order: top to bottom
    const pos = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.list > article[data-id]')].slice(0, 9).map((a) => {
        const r = a.getBoundingClientRect();
        return [Math.round(r.top), Math.round(r.left)];
      }),
    );
    for (let i = 1; i < pos.length; i++) {
      const [pt, pl] = pos[i - 1], [t, l] = pos[i];
      expect(t > pt || (t === pt && l > pl)).toBe(true);
    }
  });
}

test('desktop: Load older does not move the topmost card', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page, { marker: { last_read_id: '109000000000000100', version: 1, updated_at: '2026-10-04T05:00:00.000Z' }, posts: [] });
  await page.waitForTimeout(300);
  const btn = page.getByRole('button', { name: 'Load older' });
  const anchorId = await page.evaluate(() => document.querySelector<HTMLElement>('article[data-id]')!.dataset.id);
  const top = () => page.evaluate((i) => document.querySelector(`article[data-id="${i}"]`)!.getBoundingClientRect().top, anchorId);
  const before = await top();
  await btn.evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(1500);
  expect(Math.abs((await top()) - before)).toBeLessThan(2);
});

test('the thread stays readably narrow on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page);
  const id = await page.locator('article[data-id]').first().getAttribute('data-id');
  await page.evaluate((i) => (location.hash = `/thread/${i}`), id);
  await expect(page.locator('[data-focused] article')).toBeVisible();
  const w = await page.locator('[data-focused] article').evaluate((el) => el.getBoundingClientRect().width);
  expect(w).toBeLessThanOrEqual(640);
});

test('the app is installable (manifest, icons, service worker)', async ({ page }) => {
  await page.goto('/');
  const cdp = await page.context().newCDPSession(page);
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active != null);
  await page.reload();
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  // Playwright's context is incognito-like, so 'in-incognito' is expected; nothing else may block installation
  expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')).toEqual([]);
  const m = await (await page.request.get('/manifest.webmanifest')).json();
  expect(m.name).toBe('Ronsu');
  expect(m.icons.map((i: { purpose?: string }) => i.purpose ?? 'any').sort()).toEqual(['any', 'any', 'maskable']);
});

// A narrow screen: the column is exactly as wide as the screen, also while the timeline is still loading (it once shrank
// to its content, and then grew wider than the screen)
test('narrow screen (600px): the column is as wide as the screen while loading and when loaded', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await mockMastodon(page, { marker: null, posts: [] });
  await seedAccount(page);
  // The timeline never answers: the view stays in its loading state
  await page.route('**/api/v1/timelines/home*', () => {});
  await page.reload();
  await page.waitForSelector('.shell');
  await expect(page.getByText(/Loading|Ladataan/).first()).toBeVisible();
  const width = () => page.evaluate(() => Math.round(document.querySelector('.shell')!.getBoundingClientRect().width));
  expect(await width()).toBe(600);
});
