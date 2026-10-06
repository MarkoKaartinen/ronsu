import { describe, expect, it } from 'vitest';
import { canSend, countChars, defaultLanguage, defaultVisibility, mentionPrefix, missingAltText, pickImages, remaining } from './composeLogic';
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

describe('canSend with pictures', () => {
  const draft = { text: '', cwOn: false, cw: '', maxChars: 500 };
  it('allows a post with only a picture, but not an empty one', () => {
    expect(canSend(draft, '')).toBe(false);
    expect(canSend(draft, '', 1)).toBe(true);
  });
  it('allows a reply that only has the mentions if it has a picture', () => {
    const only = { ...draft, text: '@maija@mas.to ' };
    expect(canSend(only, '@maija@mas.to ')).toBe(false);
    expect(canSend(only, '@maija@mas.to ', 1)).toBe(true);
  });
  it('still requires the content warning text when it is on', () => {
    expect(canSend({ ...draft, cwOn: true }, '', 1)).toBe(false);
  });
});

describe('pickImages', () => {
  const file = (type: string) => new File(['x'], 'f', { type });
  it('drops everything that is not a picture', () => {
    const { accepted, overLimit } = pickImages([file('text/plain'), file('image/png'), file('video/mp4')], 4);
    expect(accepted).toHaveLength(1);
    expect(overLimit).toBe(false);
  });
  it('keeps as many as there is room for and reports the rest', () => {
    const { accepted, overLimit } = pickImages([file('image/png'), file('image/jpeg'), file('image/webp')], 2);
    expect(accepted).toHaveLength(2);
    expect(overLimit).toBe(true);
  });
  it('accepts nothing when there is no room', () => {
    expect(pickImages([file('image/png')], 0)).toEqual({ accepted: [], overLimit: true });
  });
});

describe('missingAltText', () => {
  it('is true if any picture has an empty or blank description', () => {
    expect(missingAltText([{ description: 'a cat' }, { description: '  ' }])).toBe(true);
    expect(missingAltText([{ description: 'a cat' }])).toBe(false);
    expect(missingAltText([])).toBe(false);
  });
});
