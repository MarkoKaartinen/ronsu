import { describe, expect, it } from 'vitest';
import type { Status } from './api/types';
import { canMuteConversation, remoteDomain } from './moderation';

const post = (over: Partial<Status> = {}) => ({ account: { id: '2' }, mentions: [], in_reply_to_account_id: null, ...over }) as unknown as Status;

describe('canMuteConversation', () => {
  it('is possible for own posts, replies to the user and posts that mention the user', () => {
    expect(canMuteConversation(post({ account: { id: '1' } as Status['account'] }), '1')).toBe(true);
    expect(canMuteConversation(post({ in_reply_to_account_id: '1' }), '1')).toBe(true);
    expect(canMuteConversation(post({ mentions: [{ id: '1', username: 'me', acct: 'me', url: '' }] }), '1')).toBe(true);
  });
  it('is not possible for a conversation the user is not in, or without a signed-in account', () => {
    expect(canMuteConversation(post(), '1')).toBe(false);
    expect(canMuteConversation(post(), undefined)).toBe(false);
  });
});

describe('remoteDomain', () => {
  it('is the server of a remote account and null for a local one', () => {
    expect(remoteDomain('user@mastodon.example')).toBe('mastodon.example');
    expect(remoteDomain('user')).toBeNull();
  });
});
