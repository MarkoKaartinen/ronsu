import { FONT_KEY, parseFont } from '../fonts';

function load(): string {
  try {
    return parseFont(localStorage.getItem(FONT_KEY));
  } catch {
    return parseFont(null);
  }
}

class FontStore {
  id = $state(load());

  /** Applies the chosen font to the DOM (data-font on <html>); called from an $effect */
  apply() {
    document.documentElement.setAttribute('data-font', this.id);
  }

  set(id: string) {
    this.id = parseFont(id);
    try {
      localStorage.setItem(FONT_KEY, this.id);
    } catch {
      // private browsing: the choice only lasts for this session
    }
  }
}

export const fontStore = new FontStore();
