import { describe, expect, it } from 'vitest';
import { threadRows } from './threadLogic';
import type { Status } from './api/types';

const st = (id: string, in_reply_to_id: string | null = null) => ({ id, in_reply_to_id }) as Status;

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
});
