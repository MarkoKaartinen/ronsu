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

/** From the widest to the narrowest audience */
const AUDIENCE: Visibility[] = ['public', 'unlisted', 'private', 'direct'];

/** Used when the account's own default is not known (not fetched yet, or fetching failed): never wider than followers */
export const FALLBACK_VISIBILITY: Visibility = 'private';

/** The posting privacy of the account (`source.privacy`); direct is not a default Mastodon accepts */
export function parseDefaultPrivacy(value: unknown): Visibility | null {
  return value === 'public' || value === 'unlisted' || value === 'private' ? value : null;
}

/** The one of the two with the smaller audience */
export function narrower(a: Visibility, b: Visibility): Visibility {
  return AUDIENCE.indexOf(a) >= AUDIENCE.indexOf(b) ? a : b;
}

/**
 * The visibility a new form starts with: the account's own default. A reply (or a quote) is never wider than the
 * post it answers nor than the account's default, so answering a followers-only post does not make it public and
 * answering a public one does not make a followers-only account public. Without a known default it is
 * FALLBACK_VISIBILITY, never public by accident.
 */
export function defaultVisibility(target: Status | null, accountDefault: Visibility | null): Visibility {
  const own = accountDefault ?? FALLBACK_VISIBILITY;
  return target ? narrower(target.visibility, own) : own;
}

/** Is somebody mentioned? A private mention goes only to the people mentioned in it. */
export function hasMention(text: string): boolean {
  return /(^|[^\w@])@[\w.-]+/.test(text);
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

/** A post needs text or at least one picture; a reply that only repeats the mentions does not count as text. */
export function canSend(draft: Draft, prefix: string, mediaCount = 0): boolean {
  const body = draft.text.trim();
  const hasContent = mediaCount > 0 || (body !== '' && body !== prefix.trim());
  return hasContent && remaining(draft) >= 0 && (!draft.cwOn || draft.cw.trim() !== '');
}

export interface Picked {
  /** The pictures that fit */
  accepted: File[];
  /** Some pictures did not fit under the server's limit */
  overLimit: boolean;
}

/** Keeps only pictures (drops everything else from a paste or a drop) and as many as there is room for. */
export function pickImages(files: Iterable<File>, room: number): Picked {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  const space = Math.max(0, room);
  return { accepted: images.slice(0, space), overLimit: images.length > space };
}

/** Whether any picture lacks an alt text (for the reminder before posting). */
export const missingAltText = (items: { description: string }[]) => items.some((i) => i.description.trim() === '');
