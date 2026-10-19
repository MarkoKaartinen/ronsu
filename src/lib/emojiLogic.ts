import type { CustomEmoji } from './api/types';

/** One emoji of the picker, a server's custom emoji or a Unicode one */
export interface PickerEmoji {
  /** What goes into the post: `:shortcode:` or the character. Also the key the use is counted under */
  id: string;
  label: string;
  /** Lower case words the search looks in */
  search: string;
  /** Set for a Unicode emoji */
  unicode?: string;
  /** Set for a custom emoji */
  url?: string;
}

export interface EmojiGroup {
  key: string;
  title: string;
  emojis: PickerEmoji[];
}

/** The part of the data of `emojibase-data` (`compact.json`) that the picker uses */
export interface UnicodeEmojiData {
  unicode: string;
  label: string;
  tags?: string[];
  group?: number;
  order?: number;
}

/** Emojis shown under "frequently used": the picker's width is about 9 emoji, so this is two rows */
export const FREQUENT_LIMIT = 18;

/** The `component` group of `emojibase-data` (skin tone swatches and hair parts): not emoji to post */
const COMPONENT_GROUP = 2;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The custom emoji the server wants in the picker, by category (the uncategorised first, titled `uncategorised`,
 * then A to Z) and by shortcode.
 */
export function customGroups(emojis: CustomEmoji[], uncategorised: string): EmojiGroup[] {
  const groups = new Map<string, PickerEmoji[]>();
  for (const e of emojis) {
    if (e.visible_in_picker === false) continue;
    const category = e.category?.trim() ?? '';
    const item = { id: `:${e.shortcode}:`, label: `:${e.shortcode}:`, search: e.shortcode.toLowerCase(), url: e.static_url };
    groups.set(category, [...(groups.get(category) ?? []), item]);
  }
  return [...groups]
    .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
    .map(([category, list]) => ({
      key: `custom:${category}`,
      title: category || uncategorised,
      emojis: list.sort((a, b) => a.label.localeCompare(b.label)),
    }));
}

/** The Unicode emoji by group in the order of the data, with the group titles from `labels` (by group number) */
export function unicodeGroups(data: UnicodeEmojiData[], labels: Record<number, string>): EmojiGroup[] {
  const groups = new Map<number, UnicodeEmojiData[]>();
  for (const e of [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    if (e.group === undefined || e.group === COMPONENT_GROUP) continue;
    groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([group, list]) => ({
      key: `unicode:${group}`,
      title: capitalize(labels[group] ?? ''),
      emojis: list.map((e) => ({ id: e.unicode, unicode: e.unicode, label: e.label, search: [e.label, ...(e.tags ?? [])].join(' ').toLowerCase() })),
    }));
}

/** The emoji that contain the search text (a custom one may be typed with its colons), groups left empty dropped */
export function filterGroups(groups: EmojiGroup[], search: string): EmojiGroup[] {
  const q = search.trim().toLowerCase().replace(/^:|:$/g, '');
  if (!q) return groups;
  return groups.map((g) => ({ ...g, emojis: g.emojis.filter((e) => e.search.includes(q)) })).filter((g) => g.emojis.length);
}

/** How many times each emoji (by `id`) has been inserted */
export type EmojiUse = Record<string, number>;

export const countUse = (use: EmojiUse, id: string): EmojiUse => ({ ...use, [id]: (use[id] ?? 0) + 1 });

/** The most used emoji that exist in `groups` (a custom emoji of another server does not), most used first */
export function frequentGroup(groups: EmojiGroup[], use: EmojiUse, title: string): EmojiGroup | null {
  const byId = new Map(groups.flatMap((g) => g.emojis).map((e) => [e.id, e]));
  const emojis = Object.entries(use)
    .filter(([id]) => byId.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, FREQUENT_LIMIT)
    .map(([id]) => byId.get(id)!);
  return emojis.length ? { key: 'frequent', title, emojis } : null;
}

/** The text with the emoji in place of the selection. A custom one is set apart from the words around it by spaces. */
export function insertEmoji(text: string, start: number, end: number, emoji: PickerEmoji): { text: string; cursor: number } {
  const after = text.slice(end);
  if (emoji.url === undefined) {
    const before = text.slice(0, start) + emoji.id;
    return { text: before + after, cursor: before.length };
  }
  const lead = start > 0 && !/\s/.test(text[start - 1]) ? ' ' : '';
  const before = `${text.slice(0, start)}${lead}${emoji.id} `;
  return { text: before + after.replace(/^\s/, ''), cursor: before.length };
}
