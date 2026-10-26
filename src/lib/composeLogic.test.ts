import { describe, expect, it } from 'vitest';
import { canSend, countChars, newPoll, pollDurations, pollOptions, pollValid, removePollOption, setPollOption, insertMention, mentionQueryAt, defaultLanguage, defaultVisibility, hasMention, mentionPrefix, missingAltText, parseDefaultPrivacy, pickImages, remaining } from './composeLogic';
import type { PollLimits } from './api/statuses';
import type { Status } from './api/types';

const limits: PollLimits = { maxOptions: 4, maxChars: 50, minExpiration: 300, maxExpiration: 2_629_746 };

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
  it('a new post uses the account default, whatever it is', () => {
    expect(defaultVisibility(null, 'private')).toBe('private');
    expect(defaultVisibility(null, 'unlisted')).toBe('unlisted');
    expect(defaultVisibility(null, 'public')).toBe('public');
  });
  it('without a known default it is followers only, never public', () => {
    expect(defaultVisibility(null, null)).toBe('private');
    expect(defaultVisibility(reply({ visibility: 'public' }), null)).toBe('private');
  });
  it('a reply is never wider than the post it answers', () => {
    expect(defaultVisibility(reply({ visibility: 'private' }), 'public')).toBe('private');
    expect(defaultVisibility(reply({ visibility: 'unlisted' }), 'public')).toBe('unlisted');
    expect(defaultVisibility(reply({ visibility: 'direct' }), 'public')).toBe('direct');
  });
  it('a reply is never wider than the account default either', () => {
    expect(defaultVisibility(reply({ visibility: 'public' }), 'private')).toBe('private');
    expect(defaultVisibility(reply({ visibility: 'public' }), 'unlisted')).toBe('unlisted');
    expect(defaultVisibility(reply({ visibility: 'private' }), 'private')).toBe('private');
  });
});

describe('parseDefaultPrivacy', () => {
  it('accepts what Mastodon allows as a default and nothing else', () => {
    expect(parseDefaultPrivacy('public')).toBe('public');
    expect(parseDefaultPrivacy('unlisted')).toBe('unlisted');
    expect(parseDefaultPrivacy('private')).toBe('private');
    expect(parseDefaultPrivacy('direct')).toBeNull();
    expect(parseDefaultPrivacy(undefined)).toBeNull();
    expect(parseDefaultPrivacy(42)).toBeNull();
  });
});

describe('hasMention', () => {
  it('finds a mention, not an email address', () => {
    expect(hasMention('@maija moi')).toBe(true);
    expect(hasMention('moi @maija@mas.to')).toBe(true);
    expect(hasMention('moi maija@example.org')).toBe(false);
    expect(hasMention('ei ketään')).toBe(false);
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

describe('mentionQueryAt', () => {
  it('finds the mention being typed before the cursor', () => {
    expect(mentionQueryAt('@ma', 3)).toEqual({ query: 'ma', start: 0, end: 3 });
    expect(mentionQueryAt('Hi @maija.k', 11)).toEqual({ query: 'maija.k', start: 3, end: 11 });
    expect(mentionQueryAt('Hi\n@ma', 6)).toEqual({ query: 'ma', start: 3, end: 6 });
    expect(mentionQueryAt('@maija@mas', 10)).toEqual({ query: 'maija@mas', start: 0, end: 10 });
  });

  it('only looks at the text before the cursor', () => {
    expect(mentionQueryAt('@maija and more', 3)).toEqual({ query: 'ma', start: 0, end: 3 });
  });

  it('needs a letter after the @ and a word start before it', () => {
    expect(mentionQueryAt('@', 1)).toBeNull();
    expect(mentionQueryAt('mail me: a@b', 12)).toBeNull();
    expect(mentionQueryAt('https://mas.to/@maija', 21)).toBeNull();
    expect(mentionQueryAt('@maija ', 7)).toBeNull();
  });
});

describe('insertMention', () => {
  it('replaces the typed part with the handle and moves the cursor after it', () => {
    expect(insertMention('Hi @ma', { query: 'ma', start: 3, end: 6 }, 'maija@mas.to')).toEqual({
      text: 'Hi @maija@mas.to ',
      cursor: 17,
    });
  });

  it('keeps the text after the cursor and does not double the space', () => {
    expect(insertMention('@ma there', { query: 'ma', start: 0, end: 3 }, 'maija')).toEqual({ text: '@maija there', cursor: 7 });
  });
});

describe('pollDurations', () => {
  it('offers Mastodon\'s durations that the server allows', () => {
    expect(pollDurations(limits)).toEqual([300, 1800, 3600, 21_600, 43_200, 86_400, 259_200, 604_800]);
    expect(pollDurations({ ...limits, minExpiration: 3600, maxExpiration: 86_400 })).toEqual([3600, 21_600, 43_200, 86_400]);
  });
  it('a server that allows none of them gets its nearest limit', () => {
    expect(pollDurations({ ...limits, minExpiration: 1_000_000, maxExpiration: 2_000_000 })).toEqual([1_000_000]);
  });
});

describe('newPoll', () => {
  it('starts with two empty options, one day and a single choice', () => {
    expect(newPoll(limits)).toEqual({ options: ['', ''], expiresIn: 86_400, multiple: false });
  });
  it('starts with the longest duration when the server does not allow a day', () => {
    expect(newPoll({ ...limits, maxExpiration: 43_200 }).expiresIn).toBe(43_200);
  });
});

describe('setPollOption / removePollOption', () => {
  it('a new empty option is added when the last one is filled, up to the limit', () => {
    let options = setPollOption(['', ''], 0, 'Tea', 4);
    expect(options).toEqual(['Tea', '']);
    options = setPollOption(options, 1, 'Coffee', 4);
    expect(options).toEqual(['Tea', 'Coffee', '']);
    options = setPollOption(setPollOption(options, 2, 'Water', 4), 3, 'Milk', 4);
    expect(options).toEqual(['Tea', 'Coffee', 'Water', 'Milk']); // no fifth
  });
  it('an option that is only spaces does not make room for another', () => {
    expect(setPollOption(['', ''], 1, '  ', 4)).toEqual(['', '  ']);
  });
  it('an option is removed, never below two, and room is made again when the limit had been reached', () => {
    expect(removePollOption(['Tea', 'Coffee'], 0, 4)).toEqual(['Tea', 'Coffee']);
    expect(removePollOption(['Tea', 'Coffee', 'Water', 'Milk'], 1, 4)).toEqual(['Tea', 'Water', 'Milk', '']);
  });
});

describe('pollValid / pollOptions', () => {
  const poll = (options: string[]) => ({ options, expiresIn: 86_400, multiple: false });
  it('sends the filled options without the spaces around them', () => {
    expect(pollOptions(poll([' Tea ', '', 'Coffee', '  ']))).toEqual(['Tea', 'Coffee']);
  });
  it('needs two options that differ', () => {
    expect(pollValid(poll(['Tea', '']))).toBe(false);
    expect(pollValid(poll(['Tea', ' Tea']))).toBe(false);
    expect(pollValid(poll(['Tea', 'Coffee', '']))).toBe(true);
  });
  it('a poll that is not valid keeps the post from being sent', () => {
    const draft = { text: 'Which?', cwOn: false, cw: '', maxChars: 500 };
    expect(canSend(draft, '', 0, poll(['Tea', '']))).toBe(false);
    expect(canSend(draft, '', 0, poll(['Tea', 'Coffee']))).toBe(true);
    expect(canSend(draft, '', 0, null)).toBe(true);
  });
});
