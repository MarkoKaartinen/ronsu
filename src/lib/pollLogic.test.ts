import { describe, expect, it } from 'vitest';
import type { Poll } from './api/types';
import { canVote, pick } from './pollLogic';

const poll = (over: Partial<Poll> = {}) => ({ id: '1', expired: false, voted: false, multiple: false, ...over }) as Poll;

describe('canVote', () => {
  it('an open poll the account has not voted in takes a vote', () => {
    expect(canVote(poll())).toBe(true);
    expect(canVote(poll({ voted: undefined }))).toBe(true); // a request without a token carries no `voted`
  });
  it('the account\'s own poll does not', () => {
    expect(canVote(poll(), true)).toBe(false);
  });
  it('a closed poll or one already voted in does not', () => {
    expect(canVote(poll({ expired: true }))).toBe(false);
    expect(canVote(poll({ voted: true }))).toBe(false);
  });
});

describe('pick', () => {
  it('a single-choice poll keeps only the last pick', () => {
    expect(pick([0], 2, false)).toEqual([2]);
  });
  it('a multiple-choice poll toggles the option and keeps the order', () => {
    expect(pick([2], 0, true)).toEqual([0, 2]);
    expect(pick([0, 2], 0, true)).toEqual([2]);
  });
});
