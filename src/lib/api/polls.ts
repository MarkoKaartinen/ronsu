import type { MastodonClient } from './client';
import type { Poll } from './types';

/** The poll as it is now, with the votes of others (public for a public post, `read:statuses` for a private one) */
export const getPoll = (client: MastodonClient, id: string) => client.get<Poll>(`/api/v1/polls/${id}`);

/** Votes on a poll (`write:statuses`). `choices` are the indexes of the options; the answer is the updated poll */
export const votePoll = (client: MastodonClient, id: string, choices: number[]) =>
  client.post<Poll>(`/api/v1/polls/${id}/votes`, { choices });
