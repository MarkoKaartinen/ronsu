import type { MastodonClient } from './client';
import type { Poll } from './types';

/** Votes on a poll (`write:statuses`). `choices` are the indexes of the options; the answer is the updated poll */
export const votePoll = (client: MastodonClient, id: string, choices: number[]) =>
  client.post<Poll>(`/api/v1/polls/${id}/votes`, { choices });
