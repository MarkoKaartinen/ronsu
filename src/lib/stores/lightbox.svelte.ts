import type { MediaAttachment } from '../api/types';
import { safeHttpUrl } from '../url';

/**
 * State of the image viewer (Lightbox.svelte). One viewer for the whole app.
 *
 * Opening adds a history entry, so the browser's / Android's back button closes the viewer instead of
 * leaving the page underneath it.
 */
class Lightbox {
  open = $state(false);
  items = $state<MediaAttachment[]>([]);
  index = $state(0);

  constructor() {
    addEventListener('popstate', () => {
      if (this.open && !history.state?.lightbox) this.open = false;
    });
  }

  show(all: MediaAttachment[], index: number) {
    // Only pictures with a web address; the index follows the picture that was asked for
    const wanted = all[index];
    const items = all.filter((m) => safeHttpUrl(m.url)).map((m) => ({ ...m, url: safeHttpUrl(m.url)! }));
    if (!items.length) return;
    this.items = items;
    this.index = Math.max(0, items.findIndex((m) => m.id === wanted?.id));
    if (!this.open) history.pushState({ ...history.state, lightbox: true }, '');
    this.open = true;
  }

  close() {
    if (!this.open) return;
    // Going back removes the history entry added by show(); the popstate handler then closes the viewer
    if (history.state?.lightbox) history.back();
    else this.open = false;
  }
}

export const lightbox = new Lightbox();
