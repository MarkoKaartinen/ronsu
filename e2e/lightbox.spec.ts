import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Page, server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

/** Posts divisible by 3 have pictures; post 192 is in the first page of the feed */
const card = (page: Page) => page.locator(`article[data-id="${idOf(192)}"]`);

test('a picture opens in the in-app viewer instead of a new window and closes with Esc', async ({ page, context }) => {
  await open(page, { marker: null, posts: [] });
  let popups = 0;
  context.on('page', () => popups++);

  await card(page).locator('.media a').first().click();
  const viewer = page.getByRole('dialog');
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img')).toHaveAttribute('alt', 'image 1');
  await expect(viewer.getByText('image 1', { exact: true })).toBeVisible(); // the alt text as the caption
  expect(popups).toBe(0);

  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(page).not.toHaveURL(/lightbox/);
});

test('several pictures can be browsed with the buttons and the arrow keys', async ({ page }) => {
  await open(page, { marker: null, posts: [], images: 3 });
  await card(page).locator('.media a').nth(1).click();
  const viewer = page.getByRole('dialog');

  // Opens on the picture that was tapped
  await expect(viewer.locator('.count')).toHaveText('2 / 3');
  await expect(viewer.getByRole('button', { name: 'Previous' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Next' })).toBeVisible();

  await viewer.getByRole('button', { name: 'Next' }).click();
  await expect(viewer.locator('.count')).toHaveText('3 / 3');
  await expect(viewer.getByRole('button', { name: 'Next' })).toBeHidden(); // at the end

  await page.keyboard.press('ArrowLeft');
  await expect(viewer.locator('.count')).toHaveText('2 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(viewer.locator('.count')).toHaveText('1 / 3');
  await expect(viewer.getByRole('button', { name: 'Previous' })).toBeHidden(); // at the start
});

test('a tap on the picture zooms, a tap on the dark area and the close button close', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  await card(page).locator('.media a').first().click();
  const viewer = page.getByRole('dialog');
  const zoom = viewer.getByRole('button', { name: 'Zoom to actual size' });

  await zoom.click();
  await expect(viewer).toHaveClass(/zoomed/);
  await expect(viewer.getByRole('button', { name: 'Zoom to fit' })).toBeVisible();
  await viewer.getByRole('button', { name: 'Zoom to fit' }).click();
  await expect(viewer).not.toHaveClass(/zoomed/);

  await viewer.getByRole('button', { name: 'Close' }).click();
  await expect(viewer).toBeHidden();

  // The dark area around the picture closes it as well
  await card(page).locator('.media a').first().click();
  await expect(viewer).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(viewer).toBeHidden();
});

test('the browser back button closes the viewer and stays on the page', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  const before = page.url();
  await card(page).locator('.media a').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(page.url()).toBe(before);
  await expect(page.locator('article[data-id]').first()).toBeVisible();
});

test('a modified click still opens the picture in a new tab, and the tapped card does not open the thread', async ({ page }) => {
  await open(page, { marker: null, posts: [] });
  const link = card(page).locator('.media a').first();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', /\/img\/192_0\.png$/);
  await link.click();
  await expect(page).not.toHaveURL(/#\/thread/);
});

for (const count of [2, 3, 4]) {
  test(`a gallery of ${count} pictures fills one rounded block with no empty cell`, async ({ page }) => {
    await open(page, { marker: null, posts: [], images: count });
    const rects = await card(page).locator('.media').evaluate((block) => {
      const r = (el: Element) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      return { block: r(block), cells: [...block.querySelectorAll('a')].map(r) };
    });
    expect(rects.cells).toHaveLength(count);

    // The cells (plus the 3px gaps) add up to the whole block: no area is left empty
    const area = (c: { w: number; h: number }) => c.w * c.h;
    const covered = rects.cells.reduce((sum, c) => sum + area(c), 0);
    expect(covered / area(rects.block)).toBeGreaterThan(0.96);
    expect(covered / area(rects.block)).toBeLessThanOrEqual(1.001);

    // Every cell touches the outer edge of the block on at least one side per axis (a proper rectangle)
    const right = Math.max(...rects.cells.map((c) => c.x + c.w));
    const bottom = Math.max(...rects.cells.map((c) => c.y + c.h));
    expect(Math.abs(right - (rects.block.x + rects.block.w))).toBeLessThan(1);
    expect(Math.abs(bottom - (rects.block.y + rects.block.h))).toBeLessThan(1);

    if (count === 3) {
      // One tall picture on the left, two stacked on the right
      const [first, second, third] = rects.cells;
      expect(first.h).toBeGreaterThan(second.h * 1.9);
      expect(Math.abs(second.x - third.x)).toBeLessThan(1);
      expect(third.y).toBeGreaterThan(second.y);
    }
  });
}
