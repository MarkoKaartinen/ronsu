import type { Locale } from './i18n';
import type { EmojiGroup, EmojiUse, UnicodeEmojiData } from './emojiLogic';
import { unicodeGroups } from './emojiLogic';

const USE_KEY = 'emoji-use';

// The emoji data is big (about 0.5 MB for a language), so a language is fetched only when the picker is opened
const DATA: Record<Locale, () => Promise<{ default: unknown }>> = {
  en: () => import('emojibase-data/en/compact.json'),
  fi: () => import('emojibase-data/fi/compact.json'),
};
const MESSAGES: Record<Locale, () => Promise<{ default: unknown }>> = {
  en: () => import('emojibase-data/en/messages.json'),
  fi: () => import('emojibase-data/fi/messages.json'),
};

const loaded = new Map<Locale, EmojiGroup[]>();

/** The Unicode emoji in the language (names and search words), grouped */
export async function loadUnicodeGroups(locale: Locale): Promise<EmojiGroup[]> {
  const cached = loaded.get(locale);
  if (cached) return cached;
  const [data, messages] = await Promise.all([DATA[locale](), MESSAGES[locale]()]);
  const groups = (messages.default as { groups: { order: number; message: string }[] }).groups;
  const result = unicodeGroups(data.default as UnicodeEmojiData[], Object.fromEntries(groups.map((g) => [g.order, g.message])));
  loaded.set(locale, result);
  return result;
}

export function readUse(): EmojiUse {
  try {
    const value = JSON.parse(localStorage.getItem(USE_KEY) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function saveUse(use: EmojiUse) {
  try {
    localStorage.setItem(USE_KEY, JSON.stringify(use));
  } catch {
    /* storage unavailable */
  }
}
