import { describe, expect, it } from 'vitest';
import { contrast, hexToRgb } from './color';
import { DEFAULT_PREFS, parsePrefs, resolveTheme, THEMES, themeCss, themeInitScript, type Theme } from './themes';

describe('contrast', () => {
  it('computes known values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
    expect(hexToRgb('#2e3440')).toEqual([46, 52, 64]);
  });
});

// Every theme (also ones added in the future) passes WCAG AA
describe.each(THEMES)('theme $id', (theme) => {
  const c = theme.colors;
  const onBgAndSurface = (fg: string, min: number) => {
    expect(contrast(fg, c.bg)).toBeGreaterThanOrEqual(min);
    expect(contrast(fg, c.surface)).toBeGreaterThanOrEqual(min);
  };

  it('text and muted text are readable (4.5:1) on the background and the surface', () => {
    onBgAndSurface(c.text, 4.5);
    onBgAndSurface(c.muted, 4.5);
  });
  it('the accent (links, selections) is readable (4.5:1)', () => onBgAndSurface(c.accent, 4.5));
  it('button text is readable on the accent (4.5:1)', () => {
    expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('error text is readable (4.5:1) and so is the error toast', () => {
    onBgAndSurface(c.danger, 4.5);
    expect(contrast(c.onDangerBg, c.dangerBg)).toBeGreaterThanOrEqual(4.5);
  });
  it('the boost green and the reading-position yellow are readable as text (4.5:1)', () => {
    onBgAndSurface(c.boost, 4.5);
    onBgAndSurface(c.marker, 4.5);
  });
  it('text is readable on the header bar (4.5:1)', () => {
    expect(contrast(c.text, c.header)).toBeGreaterThanOrEqual(4.5);
  });
  it('the heart icon stands out from the background (3:1, non-text)', () => {
    expect(contrast(c.like, c.bg)).toBeGreaterThanOrEqual(3);
  });
});

describe('theme list integrity', () => {
  it('ids are unique and both a light and a dark theme exist', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    expect(THEMES.some((t) => t.scheme === 'light')).toBe(true);
    expect(THEMES.some((t) => t.scheme === 'dark')).toBe(true);
  });
});

describe('themeCss', () => {
  it('contains every theme and the default in :root', () => {
    const css = themeCss();
    for (const t of THEMES) expect(css).toContain(`[data-theme="${t.id}"]`);
    expect(css).toMatch(/^:root\{--bg:#2e3440/);
    expect(css).toContain('color-scheme:light');
    expect(css).toContain('--on-accent:');
  });
});

describe('resolveTheme', () => {
  it('follows the system', () => {
    expect(resolveTheme(DEFAULT_PREFS, true).id).toBe('nord-dark');
    expect(resolveTheme(DEFAULT_PREFS, false).id).toBe('nord-light');
  });
  it('a forced mode overrides the system', () => {
    expect(resolveTheme({ ...DEFAULT_PREFS, mode: 'light' }, true).id).toBe('nord-light');
    expect(resolveTheme({ ...DEFAULT_PREFS, mode: 'dark' }, false).id).toBe('nord-dark');
  });
  it('uses the chosen pair when there are several themes', () => {
    const extra: Theme = { ...THEMES[0], id: 'muu-tumma', name: 'Muu' };
    const themes = [...THEMES, extra];
    expect(resolveTheme({ mode: 'dark', light: 'nord-light', dark: 'muu-tumma' }, false, themes).id).toBe('muu-tumma');
  });
  it('replaces an unknown or wrongly typed choice with the default', () => {
    expect(resolveTheme({ mode: 'dark', light: 'x', dark: 'poistettu' }, false).id).toBe('nord-dark');
    expect(resolveTheme({ mode: 'dark', light: 'x', dark: 'nord-light' }, false).id).toBe('nord-dark');
  });
});

describe('parsePrefs', () => {
  it('returns the defaults for an invalid or empty value', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('roskaa')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"mode":"hassu"}').mode).toBe('system');
  });
  it('reads the stored choice', () => {
    expect(parsePrefs('{"mode":"dark","light":"a","dark":"b"}')).toEqual({ mode: 'dark', light: 'a', dark: 'b' });
  });
});

describe('themeInitScript', () => {
  function run(prefs: unknown, systemDark: boolean, themes: Theme[] = THEMES) {
    const attrs: Record<string, string> = {};
    const meta = { content: '', setAttribute: (_: string, v: string) => (meta.content = v) };
    const doc = {
      documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
      querySelector: () => meta,
    };
    const ls = { getItem: () => (prefs === undefined ? null : typeof prefs === 'string' ? prefs : JSON.stringify(prefs)) };
    new Function('document', 'localStorage', 'matchMedia', themeInitScript(themes))(doc, ls, () => ({ matches: systemDark }));
    return { id: attrs['data-theme'], color: meta.content };
  }

  it('follows the system setting without stored choices', () => {
    expect(run(undefined, true)).toEqual({ id: 'nord-dark', color: '#2e3440' });
    expect(run(undefined, false)).toEqual({ id: 'nord-light', color: '#eceff4' });
  });
  it("the user's mode overrides the system", () => {
    expect(run({ mode: 'light' }, true).id).toBe('nord-light');
    expect(run({ mode: 'dark' }, false).id).toBe('nord-dark');
  });
  it('a broken or unknown choice is replaced with the default', () => {
    expect(run('{rikki', false).id).toBe('nord-light');
    expect(run('null', true).id).toBe('nord-dark');
    expect(run({ mode: 'dark', dark: 'nord-light' }, false).id).toBe('nord-dark');
  });
  it('picks the stored theme of the same mode, like resolveTheme', () => {
    const extra: Theme[] = [...THEMES, { ...THEMES[0], id: 'toinen-tumma', name: 'Toinen' }];
    for (const prefs of [{ mode: 'dark', dark: 'toinen-tumma' }, { mode: 'dark', dark: 'puuttuu' }, { mode: 'light' }]) {
      const expected = resolveTheme(parsePrefs(JSON.stringify(prefs)), false, extra).id;
      expect(run(prefs, false, extra).id).toBe(expected);
    }
  });
});
