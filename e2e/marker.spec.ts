import { expect, test, type Page } from '@playwright/test';
import { mockMastodon, seedAccount, type Server } from './mock';

const topArticle = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('.bar')!.getBoundingClientRect().bottom;
    for (const el of document.querySelectorAll<HTMLElement>('article[data-id]')) {
      const r = el.getBoundingClientRect();
      if (r.bottom - bar >= 48) return { id: el.dataset.id!, top: r.top - bar };
    }
    return null;
  });

async function open(page: Page, server: Server) {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  return logs;
}

test('the reading position is saved locally and restored after a reload', async ({ page }) => {
  const server: Server = { marker: null, posts: [] };
  const logs = await open(page, server);

  for (let y = 1500; y <= 6000; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(400);
  const seen = await topArticle(page);
  const stored = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('read-marker'))),
  );
  console.log('top:', seen, 'stored:', stored, 'logs:', logs);
  expect(Object.keys(stored).length).toBeGreaterThan(0);

  await page.reload();
  await page.waitForSelector('article[data-id]');
  await page.waitForTimeout(500);
  const first = await page.evaluate(() => document.querySelector<HTMLElement>('article[data-id]')!.dataset.id);
  console.log('first article after reload:', first, 'divider:', await page.locator('.divider').allTextContents());
  expect(first).toBe(seen!.id);
});

test('Load older does not move the screen', async ({ page }) => {
  const server: Server = { marker: { last_read_id: '109000000000000100', version: 1, updated_at: '2026-10-04T05:00:00.000Z' }, posts: [] };
  await open(page, server);
  await page.waitForTimeout(300);
  // Repeat the loads: the last one brings the oldest and removes the button (the height changes)
  let n = await page.locator('article[data-id]').count();
  for (let round = 0; round < 6; round++) {
    const btn = page.getByRole('button', { name: 'Load older' });
    if (!(await btn.count())) break;
    const anchorId = await page.evaluate(() => document.querySelector<HTMLElement>('article[data-id]')!.dataset.id);
    const top = (id: string | undefined) =>
      page.evaluate((i) => document.querySelector(`article[data-id="${i}"]`)!.getBoundingClientRect().top, id);
    const before = await top(anchorId);
    await btn.evaluate((el: HTMLElement) => el.click()); // no automatic scrolling by Playwright
    await page.waitForFunction((c) => document.querySelectorAll('article[data-id]').length > c, n, { timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(2000); // let the lazy images load
    n = await page.locator('article[data-id]').count();
    const after = await top(anchorId);
    console.log(`round ${round}: before ${before}, after ${after}, articles ${n}`);
    expect(Math.abs(after - before)).toBeLessThan(2);
  }
  expect(await page.getByRole('button', { name: 'Load older' }).count()).toBe(0);
});
