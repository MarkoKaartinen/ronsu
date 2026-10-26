import type { Poll } from './api/types';

/**
 * A poll takes a vote while it is open and this account has not voted in it (the server allows one vote per
 * account). The server refuses a vote in one's own poll ("You cannot vote in your own polls"), so it is not offered.
 */
export function canVote(poll: Poll, own = false): boolean {
  return !own && !poll.expired && !poll.voted;
}

/** The choices after the option `index` is picked: a single-choice poll has just that one, a multiple-choice poll toggles it */
export function pick(choices: number[], index: number, multiple: boolean): number[] {
  if (!multiple) return [index];
  return choices.includes(index) ? choices.filter((c) => c !== index) : [...choices, index].sort((a, b) => a - b);
}
