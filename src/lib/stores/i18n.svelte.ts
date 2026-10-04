import { LOCALE_KEY, translate, translateCounter, type Locale, type MessageKey, type Params } from '../i18n';
import { getLocale, setLocale } from '../i18n/runtime';

class I18n {
  locale = $state<Locale>(getLocale());

  constructor() {
    document.documentElement.lang = this.locale;
  }

  set(locale: Locale) {
    this.locale = locale;
    setLocale(locale);
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      /* private browsing: the choice only lasts for this session */
    }
  }
}

export const i18n = new I18n();

/** Translate a message in the current language. Reads reactive state, so templates update on change. */
export const t = (key: MessageKey, params?: Params): string => translate(i18n.locale, key, params);

/** Like t() for plural messages, split around the number so it can be styled: [before, after]. */
export const tCounter = (key: MessageKey, count: number): [string, string] => translateCounter(i18n.locale, key, count);
