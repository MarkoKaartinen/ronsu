import type { Status, Visibility } from './api/types';

/** Mastodon counts every link as 23 characters and an @user@server mention as just the username. */
export const URL_LENGTH = 23;

export function countChars(text: string): number {
  const t = text
    .replace(/https?:\/\/[^\s]+/g, 'x'.repeat(URL_LENGTH))
    .replace(/(^|[^\w])@([\w.-]+)@[\w.-]+/g, '$1@$2');
  return [...t].length;
}

/** Start of a reply: the author and everyone else mentioned, but not your own account. Empty if nobody. */
export function mentionPrefix(replyTo: Status | null, ownAcct: string): string {
  if (!replyTo) return '';
  const accts = [replyTo.account.acct, ...(replyTo.mentions ?? []).map((m) => m.acct)];
  const unique = [...new Set(accts)].filter((a) => a && a !== ownAcct);
  return unique.length ? unique.map((a) => `@${a}`).join(' ') + ' ' : '';
}

/** A reply inherits the original's visibility; a new post is public by default. */
export function defaultVisibility(replyTo: Status | null): Visibility {
  return replyTo?.visibility ?? 'public';
}

/** Post languages (ISO 639-1; Norwegian is nb on Mastodon). Empty = the server's default. */
export const LANGUAGES = ['fi', 'en', 'sv', 'de', 'fr', 'es', 'it', 'nl', 'da', 'nb', 'et', 'ru', 'pt', 'pl', 'ja'];

/**
 * Default post language: the last chosen one (an empty choice means "default"), otherwise the browser
 * language if it is in the list, otherwise empty.
 */
export function defaultLanguage(saved: string | null, browserLang: string): string {
  if (saved !== null && (saved === '' || LANGUAGES.includes(saved))) return saved;
  const short = browserLang.toLowerCase().split('-')[0];
  return LANGUAGES.includes(short) ? short : '';
}

export interface Draft {
  text: string;
  cwOn: boolean;
  cw: string;
  maxChars: number;
}

/** Characters left (the content warning text counts towards the limit). */
export function remaining({ text, cwOn, cw, maxChars }: Draft): number {
  return maxChars - countChars(text) - (cwOn ? countChars(cw) : 0);
}

export function canSend(draft: Draft, prefix: string): boolean {
  const body = draft.text.trim();
  return body !== '' && body !== prefix.trim() && remaining(draft) >= 0 && (!draft.cwOn || draft.cw.trim() !== '');
}
