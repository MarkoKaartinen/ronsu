import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT, FONTS, fontCss, fontInitScript, parseFont } from './fonts';

describe('FONTS', () => {
  it('have unique ids, include the default and the system font', () => {
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length);
    expect(FONTS.map((f) => f.id)).toContain(DEFAULT_FONT);
    expect(FONTS.find((f) => f.id === 'system')?.name).toBeNull();
  });
  it('every web font has a fallback stack so the text never disappears while it loads', () => {
    for (const f of FONTS) expect(f.stack, f.id).toMatch(/(sans-serif|monospace)$/);
  });
});

describe('parseFont', () => {
  it('accepts a known font and replaces anything else with the default', () => {
    expect(parseFont('inter')).toBe('inter');
    expect(parseFont('comic-sans')).toBe(DEFAULT_FONT);
    expect(parseFont(null)).toBe(DEFAULT_FONT);
  });
});

describe('fontCss', () => {
  it('defines --font for every font', () => {
    const css = fontCss();
    for (const f of FONTS) expect(css).toContain(`:root[data-font="${f.id}"]{--font:${f.stack}}`);
  });
});

describe('fontInitScript', () => {
  function run(stored: string | null | 'throws') {
    const attrs: Record<string, string> = {};
    const doc = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
    const ls = { getItem: () => (stored === 'throws' ? (() => { throw new Error('blocked'); })() : stored) };
    new Function('document', 'localStorage', fontInitScript())(doc, ls);
    return attrs['data-font'];
  }
  it('applies the stored font', () => expect(run('open-sans')).toBe('open-sans'));
  it('falls back to the default for an unknown value, nothing stored or blocked storage', () => {
    expect(run('nope')).toBe(DEFAULT_FONT);
    expect(run(null)).toBe(DEFAULT_FONT);
    expect(run('throws')).toBe(DEFAULT_FONT);
  });
});
