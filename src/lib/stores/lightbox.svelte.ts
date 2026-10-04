import type { MediaAttachment } from '../api/types';

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

  show(items: MediaAttachment[], index: number) {
    if (!items.length) return;
    this.items = items;
    this.index = Math.min(Math.max(index, 0), items.length - 1);
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
