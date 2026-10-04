import { en } from './en';
import { fi } from './fi';

export const LOCALES = ['en', 'fi'] as const;
export type Locale = (typeof LOCALES)[number];

/** Each language is named in itself, so it can be found even when the UI is in an unknown language. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', fi: 'Suomi' };

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_KEY = 'language';

const dictionaries: Record<Locale, Record<string, string>> = { en, fi };

/** Message keys; the plural variants `<key>.one` / `<key>.other` are addressed by `<key>`. */
type Keys = keyof typeof en;
export type MessageKey = Keys extends infer K ? (K extends `${infer B}.one` ? B : K extends `${string}.other` ? never : K) : never;
export type Params = Record<string, string | number>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Saved choice first, then the first browser language we support, otherwise English. */
export function detectLocale(saved: string | null, browserLanguages: readonly string[]): Locale {
  if (isLocale(saved)) return saved;
  for (const lang of browserLanguages) {
    const primary = lang.toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/**
 * Looks up a message and fills in `{param}` placeholders. A numeric `count` parameter selects the
 * plural variant (`<key>.one`, `<key>.other`, ...) by the language's plural rules.
 */
export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const dict = dictionaries[locale];
  let message: string | undefined;
  if (typeof params?.count === 'number') {
    const rule = new Intl.PluralRules(locale).select(params.count);
    message = dict[`${key}.${rule}`] ?? dict[`${key}.other`];
  }
  message ??= dict[key];
  if (message === undefined) return key; // never show an empty label if a key is missing
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => (params && name in params ? String(params[name]) : whole));
}

/**
 * A plural message split around its number, e.g. "3 replies" -> ["", " replies"], so the number can be
 * rendered separately (bold) between the two parts.
 */
export function translateCounter(locale: Locale, key: MessageKey, count: number): [string, string] {
  const marker = '\u0000';
  const [before, after = ''] = translate(locale, key, { count, counter: marker }).split(marker);
  return [before, after];
}

const WEEK_MS = 7 * 86400_000;

/**
 * Short relative time like Mastodon's: "now", "5m", "3h", "2d" (fi: "nyt", "5 min", "3 t", "2 pv").
 * A week or older shows a date; the year is added only when it is not the current one.
 */
export function formatRelativeTime(iso: string, locale: Locale, now = Date.now()): string {
  const then = new Date(iso);
  const ms = Math.abs(now - then.getTime());
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return translate(locale, 'time.now');
  if (minutes < 60) return translate(locale, 'time.minutes', { number: minutes });
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return translate(locale, 'time.hours', { number: hours });
  if (ms < WEEK_MS) return translate(locale, 'time.days', { number: Math.floor(ms / 86_400_000) });
  const sameYear = then.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(then);
}

/**
 * A length of time in the same short forms: "5m", "3h", "2d" (fi: "5 min", "3 t", "2 pv"). Unlike
 * formatRelativeTime it never turns into a date, so "9 days" stays "9d". Null for under a minute.
 */
export function formatAge(ms: number, locale: Locale): string | null {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return null;
  if (minutes < 60) return translate(locale, 'time.minutes', { number: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate(locale, 'time.hours', { number: hours });
  return translate(locale, 'time.days', { number: Math.floor(hours / 24) });
}

/** Full timestamp, e.g. fi "4.10.2026 klo 8.00", en "Oct 4, 2026, 08:00". */
export function formatDateTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: locale === 'fi' ? 'numeric' : 'short',
    year: 'numeric',
    hour: locale === 'fi' ? 'numeric' : '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** A date without the time, e.g. "Oct 4, 2026" / "4.10.2026". */
export function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' });
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Name of a language code in the UI language ("fi" -> "Finnish" / "suomi"), capitalised. */
export function languageName(code: string, locale: Locale): string {
  const name = new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
