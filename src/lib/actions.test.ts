import { describe, expect, it, vi } from 'vitest';
import { applyState, canReblog, endpoint, toggle } from './actions';
import type { MastodonClient } from './api/client';
import type { Status } from './api/types';

const status = (over: Partial<Status> = {}) =>
  ({ id: '42', visibility: 'public', favourites_count: 3, reblogs_count: 1, ...over }) as Status;

const client = (impl: () => Promise<unknown>) => ({ post: vi.fn(impl) }) as unknown as MastodonClient & { post: ReturnType<typeof vi.fn> };

describe('endpoint', () => {
  it('chooses the on/off endpoint', () => {
    expect(endpoint('1', 'favourite', true)).toBe('/api/v1/statuses/1/favourite');
    expect(endpoint('1', 'favourite', false)).toBe('/api/v1/statuses/1/unfavourite');
    expect(endpoint('1', 'reblog', false)).toBe('/api/v1/statuses/1/unreblog');
    expect(endpoint('1', 'bookmark', true)).toBe('/api/v1/statuses/1/bookmark');
  });
});

describe('applyState', () => {
  it('updates the flag and the counter', () => {
    const s = status();
    applyState(s, 'favourite', true);
    expect(s.favourited).toBe(true);
    expect(s.favourites_count).toBe(4);
  });
  it('does not change the counter if the state does not change, and never goes below zero', () => {
    const s = status({ favourited: true, favourites_count: 0 });
    applyState(s, 'favourite', true);
    expect(s.favourites_count).toBe(0);
    applyState(s, 'favourite', false);
    expect(s.favourites_count).toBe(0);
  });
  it('a bookmark has no counter', () => {
    const s = status();
    applyState(s, 'bookmark', true);
    expect(s.bookmarked).toBe(true);
    expect(s.favourites_count).toBe(3);
  });
});

describe('toggle', () => {
  it('updates immediately, before the response', async () => {
    let resolve!: () => void;
    const c = client(() => new Promise<void>((r) => (resolve = r)));
    const s = status();
    const p = toggle(c, s, 'reblog');
    expect(s.reblogged).toBe(true);
    expect(s.reblogs_count).toBe(2);
    resolve();
    await p;
    expect(c.post).toHaveBeenCalledWith('/api/v1/statuses/42/reblog');
  });
  it('rolls back on error and rethrows the error', async () => {
    const c = client(() => Promise.reject(new Error('422')));
    const s = status({ favourited: true, favourites_count: 5 });
    await expect(toggle(c, s, 'favourite')).rejects.toThrow('422');
    expect(s.favourited).toBe(true);
    expect(s.favourites_count).toBe(5);
  });
});

describe('canReblog', () => {
  it('allows only public and unlisted posts', () => {
    expect(canReblog(status({ visibility: 'public' }))).toBe(true);
    expect(canReblog(status({ visibility: 'unlisted' }))).toBe(true);
    expect(canReblog(status({ visibility: 'private' }))).toBe(false);
    expect(canReblog(status({ visibility: 'direct' }))).toBe(false);
  });
});
