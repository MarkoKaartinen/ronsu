import { describe, expect, it } from 'vitest';
import { threadRows } from './threadLogic';
import type { Status } from './api/types';

const st = (id: string, in_reply_to_id: string | null = null, acct = `u${id}`) =>
  ({ id, in_reply_to_id, account: { acct } }) as Status;

describe('threadRows', () => {
  it('orders ancestors, the selected post and replies', () => {
    const rows = threadRows({ ancestors: [st('1'), st('2', '1')], descendants: [st('4', '3')] }, st('3', '2'));
    expect(rows.map((r) => r.status.id)).toEqual(['1', '2', '3', '4']);
    expect(rows.map((r) => r.focused)).toEqual([false, false, true, false]);
  });
  it('indents replies by depth and caps the depth', () => {
    const rows = threadRows(
      { ancestors: [], descendants: [st('2', '1'), st('3', '2'), st('4', '3'), st('5', '4'), st('6', '1')] },
      st('1'),
    );
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 3, 3, 1]);
  });
  it('ancestors are not indented', () => {
    const rows = threadRows({ ancestors: [st('1'), st('2', '1')], descendants: [] }, st('3', '2'));
    expect(rows.map((r) => r.depth)).toEqual([0, 0, 0]);
  });
  it('a reply to an unknown parent is indented by one', () => {
    const rows = threadRows({ ancestors: [], descendants: [st('9', '999')] }, st('1'));
    expect(rows[1].depth).toBe(1);
  });
  it('marks a reply that has a deeper reply right under it', () => {
    const rows = threadRows({ ancestors: [], descendants: [st('2', '1'), st('3', '2'), st('4', '2'), st('5', '1')] }, st('1'));
    expect(rows.map((r) => r.hasChild)).toEqual([false, true, false, false, false]);
  });
  it('does not mark a reply at the depth cap as a deeper reply of its parent', () => {
    const rows = threadRows({ ancestors: [], descendants: [st('2', '1'), st('3', '2'), st('4', '3'), st('5', '4')] }, st('1'));
    expect(rows.map((r) => r.hasChild)).toEqual([false, true, true, false, false]);
  });
  it('names the author a reply answers when the post above is not that one, or the depth is capped', () => {
    const rows = threadRows(
      { ancestors: [], descendants: [st('2', '1', 'a'), st('3', '2', 'b'), st('4', '3', 'c'), st('5', '4', 'd'), st('6', '1', 'e')] },
      st('1', null, 'f'),
    );
    // 2 and 6 answer the selected post (no label), 3 and 4 the post above them with a deeper indentation
    expect(rows.map((r) => r.replyTo)).toEqual([undefined, undefined, undefined, undefined, 'c', undefined]);
  });
  it('names the author when a reply answers a reply that is not right above it', () => {
    const rows = threadRows({ ancestors: [], descendants: [st('2', '1', 'a'), st('3', '2', 'b'), st('4', '2', 'c')] }, st('1', null, 'f'));
    expect(rows.map((r) => r.replyTo)).toEqual([undefined, undefined, undefined, 'a']);
  });
  it('puts every reply right under the post it answers, whatever order the server gave', () => {
    const rows = threadRows({ ancestors: [], descendants: [st('2', '1'), st('4', '1'), st('3', '2'), st('5', '3')] }, st('1'));
    expect(rows.map((r) => r.status.id)).toEqual(['1', '2', '3', '5', '4']);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 3, 1]);
  });
  it('a reply to a post that is not in the thread comes after the replies to the selected post', () => {
    const rows = threadRows({ ancestors: [], descendants: [st('9', '999'), st('2', '1')] }, st('1'));
    expect(rows.map((r) => r.status.id)).toEqual(['1', '9', '2']);
  });
  it('tells which lines run through a row and where a line turns to the avatar', () => {
    // 1 > 2 > (3 > 4), 5 under 2, 6 under 1
    const rows = threadRows(
      { ancestors: [], descendants: [st('2', '1'), st('3', '2'), st('4', '3'), st('5', '2'), st('6', '1')] },
      st('1'),
    );
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 3, 2, 1]);
    // Row 4 (depth 3): the line of 2 goes on (5 follows), the line of 3 does not (nothing after 4 inside it)
    expect(rows[3].through).toEqual([true, false]);
    // Row 5 (depth 2): its parent's line (2) ends here, row 6 is outside it
    expect(rows[4].through).toEqual([false]);
    // The last reply of a branch has no line below it, however deep its own replies go
    const chain = threadRows({ ancestors: [], descendants: [st('2', '1'), st('3', '2'), st('4', '3')] }, st('1'));
    expect(chain.map((r) => r.through)).toEqual([[], [], [false], [false, false]]);
    expect(rows.map((r) => r.elbow)).toEqual([false, false, true, true, true, false]);
  });
});
