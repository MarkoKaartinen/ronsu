import type { PollLimits } from './api/statuses';
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

/** A poll being written: the texts of its options (the last one is usually empty, waiting to be filled), how long it is open (seconds) and whether it takes several choices */
export interface PollDraft {
  options: string[];
  expiresIn: number;
  multiple: boolean;
}

/** A poll needs at least two options (the server refuses one) */
export const MIN_POLL_OPTIONS = 2;

/** How long a poll is open: the choices Mastodon's own form offers, in seconds (5 minutes to 7 days) */
const POLL_DURATIONS = [300, 1800, 3600, 21_600, 43_200, 86_400, 259_200, 604_800];
/** The duration a new poll starts with (one day, like Mastodon's form) */
const DEFAULT_POLL_DURATION = 86_400;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The durations to choose from: Mastodon's, less those the server does not allow. A server that allows none of them gets its nearest limit */
export function pollDurations({ minExpiration, maxExpiration }: PollLimits): number[] {
  const allowed = POLL_DURATIONS.filter((d) => d >= minExpiration && d <= maxExpiration);
  return allowed.length ? allowed : [clamp(DEFAULT_POLL_DURATION, minExpiration, maxExpiration)];
}

export function newPoll(limits: PollLimits): PollDraft {
  const durations = pollDurations(limits);
  return {
    options: Array<string>(MIN_POLL_OPTIONS).fill(''),
    expiresIn: durations.includes(DEFAULT_POLL_DURATION) ? DEFAULT_POLL_DURATION : durations[durations.length - 1],
    multiple: false,
  };
}

/** Keeps one empty option at the end for the next one to be typed in, until the server's number of options is reached */
function withRoomForNext(options: string[], max: number): string[] {
  return options.length < max && options[options.length - 1].trim() !== '' ? [...options, ''] : options;
}

/** The options with the text of one changed (and a new empty one after the last, once it is filled) */
export function setPollOption(options: string[], index: number, value: string, max: number): string[] {
  return withRoomForNext(options.map((o, i) => (i === index ? value : o)), max);
}

/** The options without one (a poll never has fewer than the two it starts with) */
export function removePollOption(options: string[], index: number, max: number): string[] {
  if (options.length <= MIN_POLL_OPTIONS) return options;
  return withRoomForNext(options.filter((_, i) => i !== index), max);
}

/** The options that have text, without the spaces around it: what is sent */
export const pollOptions = (poll: PollDraft): string[] => poll.options.map((o) => o.trim()).filter((o) => o !== '');

/** A poll can be sent with at least two options that differ from each other (the server refuses a repeated one) */
export function pollValid(poll: PollDraft): boolean {
  const options = pollOptions(poll);
  return options.length >= MIN_POLL_OPTIONS && new Set(options).size === options.length;
}

/** A post needs text or at least one picture; a reply that only repeats the mentions does not count as text. A poll in it must be valid. */
export function canSend(draft: Draft, prefix: string, mediaCount = 0, poll: PollDraft | null = null): boolean {
  const body = draft.text.trim();
  const hasContent = mediaCount > 0 || (body !== '' && body !== prefix.trim());
  return hasContent && remaining(draft) >= 0 && (!draft.cwOn || draft.cw.trim() !== '') && (!poll || pollValid(poll));
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

/** A mention being typed: the text after the `@` up to the cursor, and where the `@` and the cursor are */
export interface MentionQuery {
  query: string;
  start: number;
  end: number;
}

/**
 * The mention under the cursor, if any. The `@` must start a word, so an e-mail address (`a@b`) or a link
 * (`/@user`) is not one; the part after a second `@` is the server (`user@serv`).
 */
export function mentionQueryAt(text: string, cursor: number): MentionQuery | null {
  const m = /(?:^|[^\w@/.])@([\w.-]+(?:@[\w.-]*)?)$/.exec(text.slice(0, cursor));
  return m ? { query: m[1], start: cursor - m[1].length - 1, end: cursor } : null;
}

/** The text with the mention typed so far replaced by the whole handle and a space (unless one follows already) */
export function insertMention(text: string, mention: MentionQuery, acct: string): { text: string; cursor: number } {
  const before = `${text.slice(0, mention.start)}@${acct} `;
  const after = text.slice(mention.end);
  return { text: before + after.replace(/^\s/, ''), cursor: before.length };
}
