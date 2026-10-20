import type { MastodonClient } from './client';
import type { Conversation } from './types';

/** Mastodon's own default and maximum page size for conversations */
export const CONVERSATIONS_PAGE = 20;

export const getConversations = (client: MastodonClient, maxId?: string) =>
  client.getPage<Conversation>('/api/v1/conversations', { limit: CONVERSATIONS_PAGE, max_id: maxId });

/** `write:conversations`: the conversation no longer shows as unread (on every device) */
export const markConversationRead = (client: MastodonClient, id: string) => client.post<Conversation>(`/api/v1/conversations/${id}/read`);
