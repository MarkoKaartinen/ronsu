import { describe, expect, it, vi } from 'vitest';
import { applyFollow, isFollowing, toggleFollow } from './follow';
import type { MastodonClient } from './api/client';
import type { AccountFull, Relationship } from './api/types';

const acc = (over: Partial<AccountFull> = {}) => ({ id: '2', followers_count: 10, locked: false, ...over }) as AccountFull;
const rel = (over: Partial<Relationship> = {}) =>
  ({ id: '2', following: false, requested: false, followed_by: false, blocking: false, muting: false, ...over }) as Relationship;
const client = (impl: () => Promise<unknown>) => ({ post: vi.fn(impl) }) as unknown as MastodonClient & { post: ReturnType<typeof vi.fn> };

describe('applyFollow', () => {
  it('following increases the counter', () => {
    const a = acc();
    const r = rel();
    applyFollow(r, a, true);
    expect(r.following).toBe(true);
    expect(a.followers_count).toBe(11);
  });
  it('a locked account gets a request and the counter does not change', () => {
    const a = acc({ locked: true });
    const r = rel();
    applyFollow(r, a, true);
    expect(r.requested).toBe(true);
    expect(r.following).toBe(false);
    expect(a.followers_count).toBe(10);
  });
  it('unfollowing decreases the counter, cancelling a request does not', () => {
    const a = acc();
    const r = rel({ following: true });
    applyFollow(r, a, false);
    expect(a.followers_count).toBe(9);
    const r2 = rel({ requested: true });
    applyFollow(r2, a, false);
    expect(a.followers_count).toBe(9);
    expect(isFollowing(r2)).toBe(false);
  });
});

describe('toggleFollow', () => {
  it("updates immediately and finally replaces the guess with the server's response", async () => {
    let resolve!: (v: unknown) => void;
    const c = client(() => new Promise((r) => (resolve = r)));
    const a = acc();
    const r = rel();
    const p = toggleFollow(c, a, r);
    expect(r.following).toBe(true);
    resolve(rel({ following: true, followed_by: true }));
    await p;
    expect(c.post).toHaveBeenCalledWith('/api/v1/accounts/2/follow');
    expect(r.followed_by).toBe(true);
  });
  it('unfollows through the unfollow endpoint', async () => {
    const c = client(() => Promise.resolve(rel()));
    await toggleFollow(c, acc(), rel({ following: true }));
    expect(c.post).toHaveBeenCalledWith('/api/v1/accounts/2/unfollow');
  });
  it('rolls back on error', async () => {
    const c = client(() => Promise.reject(new Error('403')));
    const a = acc();
    const r = rel();
    await expect(toggleFollow(c, a, r)).rejects.toThrow('403');
    expect(r.following).toBe(false);
    expect(a.followers_count).toBe(10);
  });
});
