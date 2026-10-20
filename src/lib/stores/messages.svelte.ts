import type { MastodonClient } from '../api/client';
import { getConversations } from '../api/conversations';
import { missingScopes } from '../api/oauth';
import { accountStore } from './accounts.svelte';

/** Is there a private mention thread the reader has not read? The server keeps the flag per conversation. */
class MessagesStore {
  hasNew = $state(false);

  /** `write:conversations` came after the first logins: they are asked to log in again */
  canMarkRead() {
    return !missingScopes(accountStore.active?.scopes).includes('write:conversations');
  }

  /** Asks the server: any unread conversation among the newest ones */
  async check(client: MastodonClient) {
    // Without the permission to mark them read the flag would stay on for good, so it is not shown
    if (!this.canMarkRead()) {
      this.hasNew = false;
      return;
    }
    try {
      this.hasNew = (await getConversations(client)).items.some((c) => c.unread);
    } catch {
      /* offline or the server is busy: whatever is shown stays, the next check corrects it */
    }
  }
}

export const messages = new MessagesStore();
