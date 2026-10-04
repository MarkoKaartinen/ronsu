import { parsePrefs, PREFS_KEY, resolveTheme, THEMES, type ThemePrefs } from '../themes';

const query = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

function load(): ThemePrefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return parsePrefs(null);
  }
}

class ThemeStore {
  prefs = $state<ThemePrefs>(load());
  private systemDark = $state(query?.matches ?? true);

  current = $derived(resolveTheme(this.prefs, this.systemDark));

  constructor() {
    query?.addEventListener('change', (e) => (this.systemDark = e.matches));
  }

  /** Applies the chosen theme to the DOM (data-theme and the browser colour); called from an $effect */
  apply() {
    document.documentElement.setAttribute('data-theme', this.current.id);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', this.current.colors.bg);
  }

  set(patch: Partial<ThemePrefs>) {
    this.prefs = { ...this.prefs, ...patch };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      // private browsing: the choice only lasts for this session
    }
  }

  options(scheme: 'light' | 'dark') {
    return THEMES.filter((t) => t.scheme === scheme);
  }
}

export const themeStore = new ThemeStore();
