/**
 * Themes are data: a new theme = a new object in the THEMES list. The CSS variables are generated at
 * build time (vite.config.ts) into a <style> block, so the theme applies from the very first paint.
 *
 * Nord (https://www.nordtheme.com): dark uses the Polar Night backgrounds, light uses Snow Storm.
 * Nord's official palette has 16 colours; muted text and the accents are adjusted slightly so the
 * text contrast meets WCAG AA (tested in themes.test.ts).
 *
 * Dracula (https://draculatheme.com/spec): "Dracula Classic" as the dark theme and its light variant
 * "Alucard Classic" as the light theme. The colours are the spec's; only the muted text and the red
 * error colours are adjusted for WCAG AA contrast (the spec's comment colour #6272a4 is too dim for text).
 */

export type Scheme = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  /** Background around the reading column on a wide screen: a shade darker than `bg`, so the column stands out */
  page: string;
  surface: string;
  /** Background of the app header bar: set apart from the page background */
  header: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  /** Text on an accent-coloured background (buttons) */
  onAccent: string;
  like: string;
  /** Boosted (icon + count) */
  boost: string;
  /** Reading position: the bookmark yellow ("You left off here") */
  marker: string;
  /** Error text on the normal background */
  danger: string;
  /** Background and text of an error toast */
  dangerBg: string;
  onDangerBg: string;
}

export interface Theme {
  id: string;
  name: string;
  scheme: Scheme;
  colors: ThemeColors;
}

export const THEMES: Theme[] = [
  {
    id: 'nord-dark',
    name: 'Nord Dark', // translated in the UI through the theme.<id> message keys
    scheme: 'dark',
    colors: {
      bg: '#2e3440', // nord0
      page: '#1f232b',
      surface: '#3b4252', // nord1
      header: '#252a34', // darker than nord0
      border: '#4c566a', // nord3
      text: '#eceff4', // nord6
      muted: '#b4bdce', // nord4, dimmed
      accent: '#88c0d0', // nord8
      onAccent: '#2e3440', // nord0
      like: '#d4727b', // nord11, lightened
      boost: '#a3be8c', // nord14
      marker: '#ebcb8b', // nord13
      danger: '#ec9fa8',
      dangerBg: '#a8434e',
      onDangerBg: '#eceff4',
    },
  },
  {
    id: 'nord-light',
    name: 'Nord Light',
    scheme: 'light',
    colors: {
      bg: '#eceff4', // nord6
      page: '#dfe4ec',
      surface: '#e5e9f0', // nord5
      header: '#d8dee9', // nord4
      border: '#c4ccda', // nord4, darkened
      text: '#2e3440', // nord0
      muted: '#4c566a', // nord3
      accent: '#46688f', // nord10, darkened
      onAccent: '#eceff4', // nord6
      like: '#bf616a', // nord11
      boost: '#40702e', // nord14, darkened
      marker: '#7d5f0f', // nord13, darkened
      danger: '#a23b46',
      dangerBg: '#a23b46',
      onDangerBg: '#eceff4',
    },
  },
  {
    id: 'dracula-dark',
    name: 'Dracula',
    scheme: 'dark',
    colors: {
      bg: '#282a36', // background
      page: '#1b1c25',
      surface: '#343746', // floating elements
      header: '#21222c', // dark background
      border: '#44475a', // selection
      text: '#f8f8f2', // foreground
      muted: '#98a3cb', // comment (#6272a4), lightened
      accent: '#bd93f9', // purple
      onAccent: '#282a36', // background
      like: '#ff79c6', // pink
      boost: '#50fa7b', // green
      marker: '#ffb86c', // orange
      danger: '#ff8080', // red, lightened
      dangerBg: '#c2384b', // red, darkened
      onDangerBg: '#f8f8f2',
    },
  },
  {
    id: 'dracula-light',
    name: 'Alucard',
    scheme: 'light',
    colors: {
      bg: '#fffbeb', // Alucard background
      page: '#e8e5d2',
      surface: '#efeddc', // floating elements
      header: '#dedccf', // light
      border: '#ceccc0', // dark
      text: '#1f1f1f', // foreground
      muted: '#6c664b', // current line
      accent: '#644ac9', // purple
      onAccent: '#fffbeb',
      like: '#a3144d', // pink
      boost: '#14710a', // green
      marker: '#a34d14', // orange
      danger: '#c0352a', // red, darkened
      dangerBg: '#cb3a2a', // red
      onDangerBg: '#fffbeb',
    },
  },
];

export const DEFAULT_DARK = 'nord-dark';
export const DEFAULT_LIGHT = 'nord-light';

const VAR_NAMES: Record<keyof ThemeColors, string> = {
  bg: '--bg',
  page: '--page',
  surface: '--surface',
  header: '--header',
  border: '--border',
  text: '--text',
  muted: '--muted',
  accent: '--accent',
  onAccent: '--on-accent',
  like: '--like',
  boost: '--boost',
  marker: '--marker',
  danger: '--danger',
  dangerBg: '--danger-bg',
  onDangerBg: '--on-danger-bg',
};

function declarations(theme: Theme): string {
  const vars = (Object.keys(VAR_NAMES) as (keyof ThemeColors)[])
    .map((k) => `${VAR_NAMES[k]}:${theme.colors[k]}`)
    .join(';');
  return `${vars};color-scheme:${theme.scheme}`;
}

/** CSS for all themes: :root gets the default theme (dark), [data-theme] overrides it. */
export function themeCss(themes: Theme[] = THEMES): string {
  const fallback = themes.find((t) => t.id === DEFAULT_DARK) ?? themes[0];
  const rules = themes.map((t) => `[data-theme="${t.id}"]{${declarations(t)}}`);
  return `:root{${declarations(fallback)}}\n${rules.join('\n')}`;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemePrefs {
  mode: ThemeMode;
  /** Choice of light and dark theme: the theme pair */
  light: string;
  dark: string;
}

export const DEFAULT_PREFS: ThemePrefs = { mode: 'system', light: DEFAULT_LIGHT, dark: DEFAULT_DARK };

export function parsePrefs(raw: string | null): ThemePrefs {
  try {
    const v = JSON.parse(raw ?? '{}');
    return {
      mode: v.mode === 'light' || v.mode === 'dark' ? v.mode : 'system',
      light: typeof v.light === 'string' ? v.light : DEFAULT_LIGHT,
      dark: typeof v.dark === 'string' ? v.dark : DEFAULT_DARK,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** The theme to use: mode + system setting; an unknown or wrongly typed choice falls back to the default. */
export function resolveTheme(prefs: ThemePrefs, systemDark: boolean, themes: Theme[] = THEMES): Theme {
  const scheme: Scheme = prefs.mode === 'dark' || (prefs.mode === 'system' && systemDark) ? 'dark' : 'light';
  const wanted = scheme === 'dark' ? prefs.dark : prefs.light;
  return (
    themes.find((t) => t.id === wanted && t.scheme === scheme) ??
    themes.find((t) => t.scheme === scheme) ??
    themes[0]
  );
}

export const PREFS_KEY = 'theme-prefs';

/**
 * Script that runs before the first paint (loaded as an external file because the CSP does not allow
 * inline scripts): sets data-theme and theme-color so the page does not flash the wrong theme. The same
 * logic as resolveTheme + parsePrefs, but independent of bundling.
 */
export function themeInitScript(themes: Theme[] = THEMES): string {
  const list = themes.map((t) => ({ id: t.id, scheme: t.scheme, bg: t.colors.bg }));
  return `(function(){try{
var T=${JSON.stringify(list)},p={};
try{p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||'{}')||{}}catch(e){}
var dark=p.mode==='dark'||(p.mode!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);
var s=dark?'dark':'light',w=dark?p.dark:p.light,t=null,i;
for(i=0;i<T.length;i++){if(T[i].scheme===s&&(t===null||T[i].id===w))t=T[i];if(T[i].scheme===s&&T[i].id===w)break}
if(!t)t=T[0];
document.documentElement.setAttribute('data-theme',t.id);
var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t.bg);
}catch(e){}})();
`;
}
