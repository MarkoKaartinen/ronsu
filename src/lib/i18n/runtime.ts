import { detectLocale, LOCALE_KEY, translate, type Locale, type MessageKey, type Params } from './index';

/**
 * Current language for code outside components (API errors, toasts, validation). Plain module, no
 * Svelte runes, so it also works in unit tests. The reactive layer is stores/i18n.svelte.ts.
 */
function initial(): Locale {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LOCALE_KEY);
  } catch {
    /* storage blocked or not available: fall back to the browser language */
  }
  const languages = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  return detectLocale(saved, languages);
}

let current: Locale = initial();

export const getLocale = (): Locale => current;

export function setLocale(locale: Locale): void {
  current = locale;
}

/** Translate in the current language, evaluated at call time. */
export const tNow = (key: MessageKey, params?: Params): string => translate(current, key, params);
