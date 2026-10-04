import { describe, expect, it } from 'vitest';
import { en } from './en';
import { fi } from './fi';
import { detectLocale, formatAge, formatDate, formatDateTime, formatRelativeTime, languageName, translate, translateCounter } from './index';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('define exactly the same keys in every language', () => {
    expect(Object.keys(fi).sort()).toEqual(Object.keys(en).sort());
  });

  it('use the same placeholders in every language', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(fi[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('have no empty messages', () => {
    for (const dict of [en, fi]) {
      for (const [key, value] of Object.entries(dict)) expect(value.trim(), key).not.toBe('');
    }
  });

  it('define both .one and .other for every plural message', () => {
    for (const dict of [en, fi]) {
      const keys = Object.keys(dict);
      for (const key of keys.filter((k) => k.endsWith('.one'))) {
        expect(keys, key).toContain(key.replace(/\.one$/, '.other'));
      }
      for (const key of keys.filter((k) => k.endsWith('.other'))) {
        expect(keys, key).toContain(key.replace(/\.other$/, '.one'));
      }
    }
  });

  it('keep the brand name untranslated', () => {
    for (const dict of [en, fi]) {
      for (const [key, value] of Object.entries(dict)) {
        if (/ronsu/i.test(value)) expect(value, key).toContain('Ronsu');
      }
    }
  });
});

describe('translate', () => {
  it('fills in placeholders', () => {
    expect(translate('en', 'status.boostedBy', { name: 'Maija' })).toBe('Maija boosted');
    expect(translate('fi', 'status.boostedBy', { name: 'Maija' })).toBe('Maija tehosti');
  });

  it('leaves unknown placeholders visible instead of breaking', () => {
    expect(translate('en', 'status.boostedBy')).toBe('{name} boosted');
  });

  it('picks the plural variant by the language rules', () => {
    expect(translate('en', 'status.replies', { count: 1, counter: '1' })).toBe('1 reply');
    expect(translate('en', 'status.replies', { count: 2, counter: '2' })).toBe('2 replies');
    expect(translate('fi', 'status.replies', { count: 1, counter: '1' })).toBe('1 vastaus');
    expect(translate('fi', 'status.replies', { count: 3, counter: '3' })).toBe('3 vastausta');
  });

  it('splits a plural message around its number', () => {
    expect(translateCounter('en', 'status.boosts', 5)).toEqual(['', ' boosts']);
    expect(translateCounter('fi', 'status.favorites', 1)).toEqual(['', ' suosikki']);
  });

  it('uses Mastodon\'s own Finnish terms', () => {
    expect(fi['action.boost']).toBe('Tehosta');
    expect(fi['action.favorite']).toBe('Suosikki');
    expect(fi['compose.publish']).toBe('Julkaise');
    expect(fi['login.server']).toBe('Palvelin');
    expect(fi['compose.visibility.unlisted']).toBe('Vaivihkaa julkinen');
  });
});

describe('detectLocale', () => {
  it('prefers a saved supported choice', () => {
    expect(detectLocale('fi', ['en-US'])).toBe('fi');
    expect(detectLocale('en', ['fi-FI'])).toBe('en');
  });
  it('uses the first supported browser language', () => {
    expect(detectLocale(null, ['sv-SE', 'fi-FI', 'en'])).toBe('fi');
    expect(detectLocale(null, ['FI'])).toBe('fi');
  });
  it('falls back to English for unsupported or invalid values', () => {
    expect(detectLocale(null, ['de-DE'])).toBe('en');
    expect(detectLocale('xx', [])).toBe('en');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-10-04T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it('uses Mastodon\'s short forms in English', () => {
    expect(formatRelativeTime(ago(20_000), 'en', now)).toBe('now');
    expect(formatRelativeTime(ago(5 * 60_000), 'en', now)).toBe('5m');
    expect(formatRelativeTime(ago(3 * 3_600_000), 'en', now)).toBe('3h');
    expect(formatRelativeTime(ago(2 * 86_400_000), 'en', now)).toBe('2d');
  });
  it('uses Mastodon\'s short forms in Finnish', () => {
    expect(formatRelativeTime(ago(20_000), 'fi', now)).toBe('nyt');
    expect(formatRelativeTime(ago(5 * 60_000), 'fi', now)).toBe('5 min');
    expect(formatRelativeTime(ago(3 * 3_600_000), 'fi', now)).toBe('3 t');
    expect(formatRelativeTime(ago(2 * 86_400_000), 'fi', now)).toBe('2 pv');
  });
  it('shows a date from a week on, with the year only for other years', () => {
    expect(formatRelativeTime(ago(10 * 86_400_000), 'en', now)).toBe('Sep 24');
    expect(formatRelativeTime('2025-01-15T10:00:00Z', 'en', now)).toBe('Jan 15, 2025');
  });
});

describe('formatAge', () => {
  const MIN = 60_000;
  it('shows minutes, hours and days in the short forms, and never turns into a date', () => {
    expect(formatAge(5 * MIN, 'en')).toBe('5m');
    expect(formatAge(3 * 60 * MIN, 'en')).toBe('3h');
    expect(formatAge(2 * 24 * 60 * MIN, 'en')).toBe('2d');
    expect(formatAge(9 * 24 * 60 * MIN, 'en')).toBe('9d'); // formatRelativeTime would give a date from a week on
    expect(formatAge(5 * MIN, 'fi')).toBe('5 min');
    expect(formatAge(3 * 60 * MIN, 'fi')).toBe('3 t');
    expect(formatAge(2 * 24 * 60 * MIN, 'fi')).toBe('2 pv');
  });
  it('is null for less than a minute (and for a negative span)', () => {
    expect(formatAge(59_000, 'en')).toBeNull();
    expect(formatAge(-5 * MIN, 'en')).toBeNull();
  });
});

describe('formatDateTime and languageName', () => {
  it('formats a full timestamp like Mastodon does for each language', () => {
    const iso = '2026-10-04T08:05:00';
    expect(formatDateTime(iso, 'fi')).toBe('4.10.2026 klo 8.05');
    expect(formatDateTime(iso, 'en')).toBe('Oct 4, 2026, 08:05');
  });
  it('formats a date without the time', () => {
    expect(formatDate('2026-10-04T08:05:00', 'fi')).toBe('4.10.2026');
    expect(formatDate('2026-10-04T08:05:00', 'en')).toBe('Oct 4, 2026');
  });
  it('names languages in the UI language, capitalised', () => {
    expect(languageName('fi', 'en')).toBe('Finnish');
    expect(languageName('en', 'fi')).toBe('Englanti');
  });
});
