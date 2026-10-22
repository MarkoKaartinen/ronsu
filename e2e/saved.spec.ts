import { expect, test, type Page } from '@playwright/test';
import { mockMastodon, seedAccount } from './mock';

const account = { id: '2', username: 'maija', acct: 'maija', display_name: 'Maija', avatar: 'https://mock.test/img/a.png', emojis: [] };
const post = (n: number) => ({
  id: String(8000 + n), created_at: new Date().toISOString(), content: `<p>Saved ${n}</p>`, spoiler_text: '', sensitive: false,
  visibility: 'public', account, media_attachments: [], mentions: [], tags: [], emojis: [], reblog: null, in_reply_to_id: null,
  replies_count: 0, reblogs_count: 0, favourites_count: 0, url: `https://mock.test/s/${n}`,
});

/**
 * The server's two lists. Paging goes by the list's own counter (`next` in the Link header), which is not a post id:
 * the first page ends with the cursor 555, and the page after it is asked for with `max_id=555`.
 */
async function open(page: Page, lists: { bookmarks?: number[]; favourites?: number[] }) {
  const asked: string[] = [];
  await mockMastodon(page, { marker: null, posts: [] });
  for (const kind of ['bookmarks', 'favourites'] as const) {
    await page.route(`https://mock.test/api/v1/${kind}**`, async (route) => {
      const url = new URL(route.request().url());
      asked.push(`${kind}:${url.searchParams.get('max_id') ?? ''}`);
      const all = lists[kind] ?? [];
      const more = !url.searchParams.get('max_id') && all.length > 2;
      await route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'Link', 'content-type': 'application/json',
          ...(more ? { link: `<https://mock.test/api/v1/${kind}?limit=20&max_id=555>; rel="next"` } : {}),
        },
        body: JSON.stringify((more ? all.slice(0, 2) : url.searchParams.get('max_id') ? all.slice(2) : all).map(post)),
      });
    });
  }
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  return asked;
}

const openFromMenu = async (page: Page, name: string) => {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name, exact: true }).click();
};

test('the bookmarks open from the menu, load older ones by the list\'s own cursor and go back', async ({ page }) => {
  const asked = await open(page, { bookmarks: [1, 2, 3] });
  await openFromMenu(page, 'Bookmarks');
  await expect(page.locator('.saved .bar')).toHaveText('Bookmarks');
  await expect(page.getByText('Saved 1')).toBeVisible();
  await expect(page.getByText('Saved 2')).toBeVisible();
  await expect(page.getByText('Saved 3')).toHaveCount(0);

  await page.getByRole('button', { name: 'Load older' }).click();
  await expect(page.getByText('Saved 3')).toBeVisible();
  expect(asked).toEqual(['bookmarks:', 'bookmarks:555']);
  await expect(page.getByRole('button', { name: 'Load older' })).toHaveCount(0);

  // A place like the others: the top and the bottom bar are there, and Home is one touch away
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
  await expect(page.locator('header.top')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home' }).click();
  await expect(page.locator('article[data-id]').first()).toBeVisible();
  await expect(page.getByText('Saved 1')).toBeHidden();
});

test('phone: the menu in the bottom bar opens a drawer with the places, and every choice closes it', async ({ page }) => {
  await open(page, { bookmarks: [1], favourites: [] });
  const bar = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(bar.getByRole('button')).toHaveCount(5);
  await bar.getByRole('button', { name: 'Menu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Menu' });
  for (const name of ['Home', 'Notifications', 'Private mentions', 'Favorites', 'Bookmarks', 'Settings', 'New post']) {
    await expect(drawer.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(drawer.getByText('@me', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/saved-drawer.png' });

  await drawer.getByRole('button', { name: 'Bookmarks', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByText('Saved 1')).toBeVisible();
});

test('the drawer closes on Escape and on the dark area, and its account and Settings open the settings page', async ({ page }) => {
  await open(page, {});
  const menu = () => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Menu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Menu' });
  await menu();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await menu();
  await page.getByRole('button', { name: 'Close' }).click({ position: { x: 10, y: 300 } });
  await expect(drawer).toHaveCount(0);

  await menu();
  await drawer.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Account and settings' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home' }).click();
  await menu();
  await drawer.getByRole('button', { name: /^Account: / }).click();
  await expect(page.getByRole('region', { name: 'Account and settings' })).toBeVisible();
});

test('the favorites are a list of their own, and an empty one says so', async ({ page }) => {
  const asked = await open(page, { bookmarks: [1], favourites: [] });
  await openFromMenu(page, 'Favorites');
  await expect(page.getByText("You don't have any favorite posts yet.")).toBeVisible();
  expect(asked).toEqual(['favourites:']);
});

test('on a wide screen the sidebar has both lists', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 900 });
  await open(page, { bookmarks: [1], favourites: [2] });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Favorites' }).click();
  await expect(page.getByText('Saved 2')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Bookmarks' }).click();
  await expect(page.getByText('Saved 1')).toBeVisible();
  await page.screenshot({ path: 'test-results/saved-wide.png' });
});

for (const [name, viewport] of [['wide', { width: 1300, height: 900 }], ['phone', { width: 420, height: 800 }]] as const) {
  test(`${name}: the bar of the feed, the private mentions and the saved lists are equally high`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page, { bookmarks: [1] });
    const height = (selector: string) => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().height);
    const feed = await height('.bar:has(.row)');

    await (name === 'wide'
      ? page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Private mentions' })
      : page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Private mentions' })
    ).click();
    await expect(page.locator('.messages .bar')).toBeVisible();
    expect(Math.abs((await height('.messages .bar')) - feed)).toBeLessThan(1);
    await page.screenshot({ path: `test-results/bar-messages-${name}.png` });

    await page.evaluate(() => (location.hash = '#/bookmarks'));
    await expect(page.locator('.saved .bar')).toBeVisible();
    expect(Math.abs((await height('.saved .bar')) - feed)).toBeLessThan(1);
    await page.screenshot({ path: `test-results/bar-saved-${name}.png` });
  });
}

test('wide: the settings open in the middle column, beside the sidebar and the notifications, and the sidebar leaves them', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 900 });
  await open(page, { bookmarks: [1] });
  const feed = await page.locator('.bar:has(.row)').first().evaluate((el) => el.getBoundingClientRect().height);
  await page.getByRole('button', { name: /^Account: / }).click();
  const settings = page.getByRole('region', { name: 'Account and settings' });
  await expect(settings).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load new' })).toBeHidden(); // nothing else is needed beside the settings
  expect(Math.abs((await settings.locator('.bar').first().evaluate((el) => el.getBoundingClientRect().height)) - feed)).toBeLessThan(1);
  await page.screenshot({ path: 'test-results/settings-wide.png' });

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Bookmarks' }).click();
  await expect(settings).toHaveCount(0);
  await expect(page.getByText('Saved 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load new' })).toBeVisible(); // the notifications are back
});

test('phone: the settings have the top and the bottom bar and the same title bar, without an arrow', async ({ page }) => {
  await open(page, {});
  const feed = await page.locator('.bar:has(.row)').first().evaluate((el) => el.getBoundingClientRect().height);
  await page.getByRole('button', { name: /^Account: / }).click();
  const settings = page.getByRole('region', { name: 'Account and settings' });
  await expect(settings).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
  await expect(page.locator('header.top')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  expect(Math.abs((await settings.locator('.bar').first().evaluate((el) => el.getBoundingClientRect().height)) - feed)).toBeLessThan(1);
  await page.screenshot({ path: 'test-results/settings-phone.png' });
});
