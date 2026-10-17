import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount } from './mock';

async function openFeed(page: Page, aspect: number) {
  await page.setViewportSize({ width: 1000, height: 800 });
  await mockMastodon(page, { marker: null, posts: [], images: 1, aspect });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector(`article[data-id="${idOf(192)}"] .media`);
}

// A picture that is wide, nearly square, square or tall (the tall ones hit the 28rem height limit)
for (const aspect of [2, 1.15, 1, 0.7]) {
  test(`a single picture (aspect ${aspect}) is wrapped exactly: the rounded block has the picture's size`, async ({ page }) => {
    await openFeed(page, aspect);
    const sizes = await page.locator(`article[data-id="${idOf(192)}"] .media`).evaluate((block) => {
      const r = (el: Element) => { const b = el.getBoundingClientRect(); return { w: b.width, h: b.height }; };
      return { block: r(block), link: r(block.querySelector('a')!), img: r(block.querySelector('img')!), rem: parseFloat(getComputedStyle(document.documentElement).fontSize) };
    });

    // No empty space beside or under the picture, so the block's rounded corners are the picture's corners
    expect(Math.abs(sizes.block.w - sizes.link.w)).toBeLessThan(1);
    expect(Math.abs(sizes.block.h - sizes.link.h)).toBeLessThan(1);
    expect(Math.abs(sizes.link.w - sizes.img.w)).toBeLessThan(1);
    expect(Math.abs(sizes.link.h - sizes.img.h)).toBeLessThan(1);

    // The shape follows the picture's aspect ratio and is never taller than 28rem
    expect(sizes.block.h).toBeLessThanOrEqual(28 * sizes.rem + 1);
    expect(Math.abs(sizes.block.w / sizes.block.h - aspect)).toBeLessThan(0.02);
  });
}

test('sensitive pictures are blurred in place and shown by the button', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await mockMastodon(page, { marker: null, posts: [], images: 1, sensitive: true });
  await seedAccount(page);
  await page.reload();
  const media = page.locator(`article[data-id="${idOf(192)}"] .media`);
  await media.waitFor();

  // The picture is there (so the layout does not jump) but blurred, with the button over it and out of reach
  await expect(media).toHaveClass(/hidden/);
  await expect(media.locator('img')).toHaveCSS('filter', /blur/);
  await expect(media.locator('a')).toHaveJSProperty('inert', true);
  await media.screenshot({ path: 'test-results/sensitive-hidden.png' });
  const before = await media.boundingBox();

  await media.getByRole('button').click();
  await expect(media).not.toHaveClass(/hidden/);
  await expect(media.locator('img')).toHaveCSS('filter', 'none');
  await expect(media.locator('a')).toHaveJSProperty('inert', false);
  await expect(media.getByRole('button')).toHaveCount(0);
  expect(Math.abs((await media.boundingBox())!.height - before!.height)).toBeLessThan(1);
});
