import { expect, test, type Page } from '@playwright/test';
import { idOf, mockMastodon, seedAccount } from './mock';

async function open(page: Page) {
  await page.setViewportSize({ width: 420, height: 800 });
  await mockMastodon(page, { marker: null, posts: [], formatted: true });
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
}

const post = (page: Page) => page.locator(`article[data-id="${idOf(163)}"]`); // 163 % 5 === 3: has a quote, code and a list

test('a quote has a bar and a small indent instead of the browser default, code and lists are styled', async ({ page }) => {
  await open(page);
  const quote = post(page).locator('.content blockquote');
  const css = await quote.evaluate((el) => {
    const c = getComputedStyle(el);
    return { marginLeft: c.marginLeft, borderLeft: c.borderLeftWidth, borderStyle: c.borderLeftStyle, paddingLeft: c.paddingLeft };
  });
  expect(css.marginLeft).toBe('0px'); // the default is 40px
  expect(css.borderLeft).toBe('3px');
  expect(css.borderStyle).toBe('solid');
  expect(parseFloat(css.paddingLeft)).toBeGreaterThan(8);

  // The text of the quote is no wider than the post's text column and wraps inside it
  const [q, content] = await Promise.all([quote.boundingBox(), post(page).locator('.content').boundingBox()]);
  expect(q!.x).toBeGreaterThanOrEqual(content!.x - 1);
  expect(q!.x + q!.width).toBeLessThanOrEqual(content!.x + content!.width + 1);

  // A code block scrolls inside itself instead of widening the page, and code is monospaced
  const pre = await post(page).locator('.content pre').evaluate((el) => ({ family: getComputedStyle(el.querySelector('code')!).fontFamily, overflowX: getComputedStyle(el).overflowX, bg: getComputedStyle(el).backgroundColor }));
  expect(pre.family).toMatch(/mono|Menlo|Consolas/i);
  expect(pre.overflowX).toBe('auto');
  expect(pre.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // A list keeps its bullets and a modest indent
  const list = await post(page).locator('.content ul').evaluate((el) => ({ type: getComputedStyle(el).listStyleType, pad: parseFloat(getComputedStyle(el).paddingLeft) }));
  expect(list.type).toBe('disc');
  expect(list.pad).toBeGreaterThan(10);
  expect(list.pad).toBeLessThan(40);
});

test('a boost shows who boosted on top and the original in a frame, with a label in the boost colour', async ({ page }) => {
  await mockMastodon(page, { marker: null, posts: [], boosted: true });
  await seedAccount(page);
  await page.reload();
  await expect(page.locator('article[data-id]:has(article.quoted) > .layout > .body > header').first()).toContainText('Daniel');
  await expect(page.locator('article.quoted').first()).toBeVisible();
  // The frame is indented like the text of other posts: it starts to the right of the booster's avatar
  const x = await page.locator('article[data-id]:has(article.quoted)').first().evaluate((a) => ({ avatar: a.querySelector('.avatar')!.getBoundingClientRect().right, frame: a.querySelector('article.quoted')!.getBoundingClientRect().left }));
  expect(x.frame).toBeGreaterThan(x.avatar);
  const label = page.locator('.boostlabel').first();
  await expect(label).toHaveText('Boost');
  const style = await label.evaluate((el) => ({ color: getComputedStyle(el).color, weight: getComputedStyle(el).fontWeight, boost: getComputedStyle(document.documentElement).getPropertyValue('--boost').trim() }));
  expect(Number(style.weight)).toBeGreaterThanOrEqual(600);
  // The colour is the theme's boost colour, not the muted grey
  const swatch = await page.evaluate((c) => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; }, style.boost);
  expect(style.color).toBe(swatch);
});

test('a quote inside a boosted post has its own, different background so it stands out from the outer frame', async ({ page }) => {
  await mockMastodon(page, { marker: null, posts: [], boosted: true, boostedQuote: true });
  await seedAccount(page);
  await page.reload();
  const outer = page.locator('article.quoted').first();
  const inner = outer.locator('article.quoted');
  await expect(inner).toHaveCount(1);
  const bg = (l: typeof outer) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg(inner)).not.toBe(await bg(outer));
});
