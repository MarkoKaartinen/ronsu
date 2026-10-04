import { describe, expect, it } from 'vitest';
import { normalizePage, pageParams, pickTopId } from './feedLogic';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const s = (...list: string[]) => list.map((id) => ({ id }));

describe('normalizePage', () => {
  it('sorts oldest first even though the API returns newest first', () => {
    expect(ids(normalizePage('oldest-first', s('110', '109', '99')))).toEqual(['99', '109', '110']);
  });
  it('sorts newest first', () => {
    expect(ids(normalizePage('newest-first', s('99', '110', '109')))).toEqual(['110', '109', '99']);
  });
});

describe('pageParams', () => {
  it('oldest first: starts from the reading position', () => {
    expect(pageParams('oldest-first', [], '500')).toMatchObject({ min_id: '500' });
  });
  it('oldest first: continues from the last shown post', () => {
    expect(pageParams('oldest-first', s('501', '502'), '500')).toMatchObject({ min_id: '502' });
  });
  it('oldest first without a reading position fetches the newest', () => {
    const p = pageParams('oldest-first', [], null);
    expect(p).not.toHaveProperty('min_id');
    expect(p).not.toHaveProperty('max_id');
  });
  it('newest first: paginates with max_id', () => {
    expect(pageParams('newest-first', s('900', '899'), '500')).toMatchObject({ max_id: '899' });
    expect(pageParams('newest-first', [], '500')).not.toHaveProperty('max_id');
  });
});

describe('pickTopId', () => {
  it('picks the topmost post on screen', () => {
    const rects = [
      { id: '100', bottom: -300 },
      { id: '101', bottom: 200 },
      { id: '102', bottom: 700 },
    ];
    expect(pickTopId(rects, 50)).toBe('101');
  });
  it('skips a post that is only a sliver at the top edge', () => {
    const rects = [
      { id: '100', bottom: 70 },
      { id: '101', bottom: 500 },
    ];
    expect(pickTopId(rects, 50)).toBe('101');
  });
  it('returns null when nothing is visible', () => {
    expect(pickTopId([], 50)).toBeNull();
    expect(pickTopId([{ id: '1', bottom: -10 }], 50)).toBeNull();
  });
});
