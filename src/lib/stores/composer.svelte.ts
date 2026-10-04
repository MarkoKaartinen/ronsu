import type { Status } from '../api/types';

/** State of the reply / compose form. One form for the whole app (Compose.svelte). */
class Composer {
  open = $state(false);
  replyTo = $state<Status | null>(null);
  /** Increases on every successful post; the thread view refreshes based on it */
  postedTick = $state(0);

  show(replyTo: Status | null = null) {
    this.replyTo = replyTo;
    this.open = true;
  }

  close() {
    this.open = false;
  }

  posted() {
    this.postedTick++;
  }
}

export const composer = new Composer();
