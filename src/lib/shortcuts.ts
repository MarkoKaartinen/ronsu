/**
 * Keyboard shortcuts. The defaults are Mastodon's own web interface (j/k, r, f, b, o, p, x, e, n, backspace, `g` then a
 * letter to go to a view, `?` for the help), plus the ones Ronsu needs for its own way of reading (load more).
 * A binding is one key or two keys in a row ("g h"); the user can change them in the settings. No modifier keys:
 * Ctrl, Alt and Meta belong to the browser and the system.
 */

export type ShortcutGroup = 'posts' | 'feed' | 'go';

export interface ShortcutAction {
  id: string;
  group: ShortcutGroup;
  /** Mastodon's key, or Ronsu's own where Mastodon has none */
  default: string;
}

export const SHORTCUT_ACTIONS = [
  { id: 'down', group: 'posts', default: 'j' },
  { id: 'up', group: 'posts', default: 'k' },
  { id: 'reply', group: 'posts', default: 'r' },
  { id: 'boost', group: 'posts', default: 'b' },
  { id: 'favourite', group: 'posts', default: 'f' },
  { id: 'bookmark', group: 'posts', default: 'd' },
  { id: 'quote', group: 'posts', default: 'q' },
  { id: 'openThread', group: 'posts', default: 'o' },
  { id: 'openProfile', group: 'posts', default: 'p' },
  { id: 'openMedia', group: 'posts', default: 'e' },
  { id: 'toggleWarning', group: 'posts', default: 'x' },
  { id: 'toggleMedia', group: 'posts', default: 'h' },
  { id: 'loadNew', group: 'feed', default: 'u' },
  { id: 'loadOlder', group: 'feed', default: 'l' },
  { id: 'newPost', group: 'feed', default: 'n' },
  { id: 'back', group: 'feed', default: 'Backspace' },
  { id: 'help', group: 'feed', default: '?' },
  { id: 'goHome', group: 'go', default: 'g h' },
  { id: 'goNotifications', group: 'go', default: 'g n' },
  { id: 'goMessages', group: 'go', default: 'g m' },
  { id: 'goFavourites', group: 'go', default: 'g f' },
  { id: 'goBookmarks', group: 'go', default: 'g b' },
  { id: 'goSettings', group: 'go', default: 'g s' },
] as const satisfies readonly ShortcutAction[];

export type ShortcutId = (typeof SHORTCUT_ACTIONS)[number]['id'];
/** An empty string is a shortcut that is switched off */
export type Bindings = Record<ShortcutId, string>;

export const SHORTCUTS_KEY = 'ronsu-shortcuts';

/** How long the second key of a two-key shortcut can take (a person pressing two keys one after the other) */
export const CHORD_MS = 1500;

export const DEFAULT_BINDINGS = Object.fromEntries(SHORTCUT_ACTIONS.map((a) => [a.id, a.default])) as Bindings;

/** Keys that cannot be a shortcut: the modifiers themselves, and the keys that leave a field or move the focus */
const RESERVED = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Dead', 'Unidentified', 'Escape', 'Tab', 'Process']);

/**
 * The name of the key pressed, or null when it cannot be a shortcut (a modifier alone, Escape, Tab, or a key with
 * Ctrl, Alt or Meta held). A letter is as typed, so Shift+L is "L"; the space bar is "Space", because a space
 * separates the two keys of a binding.
 */
export function keyName(e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }): string | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  if (RESERVED.has(e.key)) return null;
  return e.key === ' ' ? 'Space' : e.key;
}

/** Is it "" (off), one key, or two keys in a row? */
export function validBinding(binding: unknown): binding is string {
  if (typeof binding !== 'string') return false;
  if (binding === '') return true;
  const keys = binding.split(' ');
  return keys.length <= 2 && keys.every((k) => k !== '' && !RESERVED.has(k));
}

/** Another action that uses the binding, or whose binding starts with it or is the start of it ("g" and "g h" collide) */
export function findConflict(bindings: Bindings, id: ShortcutId, binding: string): ShortcutId | null {
  if (binding === '') return null;
  for (const a of SHORTCUT_ACTIONS) {
    const other = bindings[a.id];
    if (a.id === id || other === '') continue;
    if (other === binding || other.startsWith(binding + ' ') || binding.startsWith(other + ' ')) return a.id;
  }
  return null;
}

/** The saved changes on top of the defaults; anything unknown, invalid or colliding is ignored */
export function parseBindings(raw: string | null): Bindings {
  const bindings = { ...DEFAULT_BINDINGS };
  let saved: unknown;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    return bindings;
  }
  if (!saved || typeof saved !== 'object') return bindings;
  const changes = SHORTCUT_ACTIONS.flatMap((a) => {
    const v = (saved as Record<string, unknown>)[a.id];
    return validBinding(v) ? [[a.id, v] as const] : [];
  });
  // The changed actions are first set free, so two actions that swapped keys can both be restored; one that still
  // collides gets its default back, and is switched off if even that is taken
  for (const [id] of changes) bindings[id] = '';
  for (const [id, binding] of changes) {
    const wanted = [binding, DEFAULT_BINDINGS[id]].find((b) => !findConflict(bindings, id, b));
    bindings[id] = wanted ?? '';
  }
  return bindings;
}

/** Only what differs from the defaults is saved, so a new default reaches everyone who has not changed that action */
export function serializeBindings(bindings: Bindings): string {
  return JSON.stringify(Object.fromEntries(SHORTCUT_ACTIONS.filter((a) => bindings[a.id] !== a.default).map((a) => [a.id, bindings[a.id]])));
}

export interface Match {
  action: ShortcutId | null;
  /** The keys pressed so far of a two-key shortcut */
  pending: string[];
}

/** Takes the next key and says which action it completes, or what is waiting for its second key */
export function matchKey(bindings: Bindings, pending: string[], key: string): Match {
  const candidate = [...pending, key].join(' ');
  const exact = SHORTCUT_ACTIONS.find((a) => bindings[a.id] === candidate);
  if (exact) return { action: exact.id, pending: [] };
  if (SHORTCUT_ACTIONS.some((a) => bindings[a.id].startsWith(candidate + ' '))) return { action: null, pending: [...pending, key] };
  // A wrong second key: start over with it, as it may be the first key of something
  return pending.length ? matchKey(bindings, [], key) : { action: null, pending: [] };
}

/** For the screen: the keys of a binding as they are written on a keyboard */
export const keysOf = (binding: string): string[] => (binding === '' ? [] : binding.split(' '));
