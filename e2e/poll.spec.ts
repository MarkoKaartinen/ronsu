import { expect, test } from '@playwright/test';
import { mockMastodon, seedAccount, type Server } from './mock';

async function open(page: Parameters<typeof mockMastodon>[0], server: Server) {
  await mockMastodon(page, server);
  await seedAccount(page);
  await page.reload();
  await page.waitForSelector('article[data-id]');
  return page.locator('article[data-id]').first();
}

test('a single-choice poll is voted on and then shows the results with the own vote', async ({ page }) => {
  const server: Server = { marker: null, posts: [], poll: {} };
  const card = await open(page, server);
  const vote = card.getByRole('button', { name: 'Vote' });
  const url = page.url();

  await expect(vote).toBeDisabled();
  await card.getByLabel('Coffee').check();
  await card.getByLabel('Water').check(); // a single-choice poll keeps the last pick only
  await vote.click();

  const water = card.locator('li', { hasText: 'Water' });
  await expect(water).toContainText('40%'); // 2 of 5 votes
  await expect(water.getByLabel('Your vote')).toBeVisible();
  await expect(vote).toHaveCount(0);
  expect(server.votes).toEqual([[2]]);
  expect(page.url()).toBe(url); // ticking an option did not open the thread
});

test('a multiple-choice poll takes several options at once', async ({ page }) => {
  const server: Server = { marker: null, posts: [], poll: { multiple: true } };
  const card = await open(page, server);

  await card.getByLabel('Tea').check();
  await card.getByLabel('Water').check();
  await card.getByRole('button', { name: 'Vote' }).click();

  await expect(card.getByRole('button', { name: 'Vote' })).toHaveCount(0);
  expect(server.votes).toEqual([[0, 2]]);
});

test('a poll that has ended or was voted in shows no vote button', async ({ page }) => {
  for (const poll of [{ expired: true }, { voted: true }]) {
    const server: Server = { marker: null, posts: [], poll };
    const card = await open(page, server);
    await expect(card.getByRole('button', { name: 'Vote' })).toHaveCount(0);
    await expect(card.locator('li').first()).toBeVisible();
  }
});

test('a vote the server refuses shows a notice and the poll stays open', async ({ page }) => {
  const server: Server = { marker: null, posts: [], poll: {}, failActions: true };
  const card = await open(page, server);

  await card.getByLabel('Tea').check();
  await card.getByRole('button', { name: 'Vote' }).click();

  await expect(page.getByRole('alert')).toContainText('Something went wrong');
  await expect(card.getByRole('button', { name: 'Vote' })).toBeEnabled();
});
