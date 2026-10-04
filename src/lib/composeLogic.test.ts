import { describe, expect, it } from 'vitest';
import { canSend, countChars, defaultLanguage, defaultVisibility, mentionPrefix, remaining } from './composeLogic';
import type { Status } from './api/types';

const reply = (over: Partial<Status> = {}) =>
  ({ account: { acct: 'maija@mas.to' }, mentions: [], visibility: 'unlisted', ...over }) as Status;

describe('countChars', () => {
  it('counts a link as 23 characters', () => {
    expect(countChars('see https://example.com/a/very/long/address/that/keeps/going')).toBe(4 + 23);
  });
  it('counts an @user@server mention as the username', () => {
    expect(countChars('hi @maija@mas.to!')).toBe('hi @maija!'.length);
    expect(countChars('hi @maija')).toBe(9);
  });
  it('counts an emoji as one character', () => {
    expect(countChars('😀😀')).toBe(2);
  });
});

describe('mentionPrefix', () => {
  it('mentions the author and the others mentioned, not your own account', () => {
    const s = reply({ mentions: [{ id: '1', username: 'marko', acct: 'marko', url: '' }, { id: '2', username: 'pekka', acct: 'pekka', url: '' }] });
    expect(mentionPrefix(s, 'marko')).toBe('@maija@mas.to @pekka ');
  });
  it('is empty for a new post and for your own post', () => {
    expect(mentionPrefix(null, 'marko')).toBe('');
    expect(mentionPrefix(reply({ account: { acct: 'marko' } as Status['account'] }), 'marko')).toBe('');
  });
  it('does not repeat the same mention', () => {
    const s = reply({ mentions: [{ id: '1', username: 'maija', acct: 'maija@mas.to', url: '' }] });
    expect(mentionPrefix(s, 'marko')).toBe('@maija@mas.to ');
  });
});

describe('defaultVisibility', () => {
  it('inherits from the post replied to, a new one is public', () => {
    expect(defaultVisibility(reply({ visibility: 'private' }))).toBe('private');
    expect(defaultVisibility(null)).toBe('public');
  });
});

describe('remaining / canSend', () => {
  const draft = { text: 'moi', cwOn: false, cw: '', maxChars: 10 };
  it('the CW text counts towards the character limit', () => {
    expect(remaining(draft)).toBe(7);
    expect(remaining({ ...draft, cwOn: true, cw: 'abcd' })).toBe(3);
  });
  it('blocks an empty post, a bare mention and exceeding the limit', () => {
    expect(canSend(draft, '')).toBe(true);
    expect(canSend({ ...draft, text: '  ' }, '')).toBe(false);
    expect(canSend({ ...draft, text: '@maija ' }, '@maija ')).toBe(false);
    expect(canSend({ ...draft, text: 'x'.repeat(11) }, '')).toBe(false);
    expect(canSend({ ...draft, cwOn: true, cw: ' ' }, '')).toBe(false);
  });
});

describe('defaultLanguage', () => {
  it('uses the last chosen one, also the empty one (default)', () => {
    expect(defaultLanguage('sv', 'fi-FI')).toBe('sv');
    expect(defaultLanguage('', 'fi-FI')).toBe('');
  });
  it('uses the browser language if it is in the list', () => {
    expect(defaultLanguage(null, 'fi-FI')).toBe('fi');
    expect(defaultLanguage(null, 'EN-us')).toBe('en');
  });
  it('returns empty for an unknown language and for an invalid stored value', () => {
    expect(defaultLanguage(null, 'xx-YY')).toBe('');
    expect(defaultLanguage('zz', 'fi')).toBe('fi');
  });
});
