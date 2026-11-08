import { DEFAULT_BINDINGS, findConflict, parseBindings, serializeBindings, SHORTCUTS_KEY, type Bindings, type ShortcutId } from '../shortcuts';

function load(): Bindings {
  try {
    return parseBindings(localStorage.getItem(SHORTCUTS_KEY));
  } catch {
    return parseBindings(null);
  }
}

/** The keys of the keyboard shortcuts, per device like the other settings (theme, font) */
class ShortcutStore {
  bindings = $state<Bindings>(load());
  /** The help dialog (`?`) is open */
  helpOpen = $state(false);
  /** The settings are waiting for a key to be pressed: the shortcuts themselves must not react to it */
  recording = $state(false);

  /** Sets a binding; returns the action that already has it (and changes nothing) */
  set(id: ShortcutId, binding: string): ShortcutId | null {
    const conflict = findConflict(this.bindings, id, binding);
    if (conflict) return conflict;
    this.bindings[id] = binding;
    this.save();
    return null;
  }

  reset(id: ShortcutId) {
    // The default may be taken by an action the user has moved to it: that one is switched off
    const def = DEFAULT_BINDINGS[id];
    for (let other = findConflict(this.bindings, id, def); other; other = findConflict(this.bindings, id, def)) this.bindings[other] = '';
    this.bindings[id] = def;
    this.save();
  }

  resetAll() {
    this.bindings = { ...DEFAULT_BINDINGS };
    this.save();
  }

  private save() {
    try {
      localStorage.setItem(SHORTCUTS_KEY, serializeBindings(this.bindings));
    } catch {
      // private browsing: the choice only lasts for this session
    }
  }
}

export const shortcutStore = new ShortcutStore();
