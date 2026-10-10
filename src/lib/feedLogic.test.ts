import { describe, expect, it } from 'vitest';
import { advanceMarker, normalizePage, pageParams, pickLastVisibleId, pickTopId, skippedBetween } from './feedLogic';

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

describe('pickLastVisibleId', () => {
  const boxes = [
    { id: '100', top: -400, bottom: -100 },
    { id: '101', top: -100, bottom: 250 },
    { id: '102', top: 250, bottom: 600 },
    { id: '103', top: 600, bottom: 950 },
    { id: '104', top: 950, bottom: 1300 },
  ];
  it('picks the lowest post that is on screen', () => {
    expect(pickLastVisibleId(boxes, 50, 800)).toBe('103');
  });
  it('ignores a post that only just peeks in at the bottom edge', () => {
    expect(pickLastVisibleId(boxes, 50, 620)).toBe('102'); // 103 shows 20px, less than the 40px needed
    expect(pickLastVisibleId(boxes, 50, 700)).toBe('103'); // 100px of it shows
  });
  it('at the end of the feed it is the last post', () => {
    expect(pickLastVisibleId(boxes.slice(-2), 50, 1000)).toBe('104');
  });
  it('returns null when nothing is on screen', () => {
    expect(pickLastVisibleId([], 50, 800)).toBeNull();
    expect(pickLastVisibleId([{ id: '1', top: -500, bottom: -20 }], 50, 800)).toBeNull();
  });
});

describe('advanceMarker (newest first)', () => {
  const items = ['105', '104', '103', '102', '101', '100'].map((id) => ({ id }));
  const seen = (...ids: string[]) => new Set(ids);

  it('moves up from the divider over the unbroken run of seen posts', () => {
    expect(advanceMarker(items, '101', seen('102', '103'))).toBe('103');
    expect(advanceMarker(items, '101', seen('102', '103', '105'))).toBe('103'); // 104 was skipped: stop there
  });
  it('goes all the way to the newest when the reader came down from the top', () => {
    expect(advanceMarker(items, '102', seen('105', '104', '103'))).toBe('105');
  });
  it('does not move when the next post has not been seen, or the position is not in the list', () => {
    expect(advanceMarker(items, '101', seen('104', '105'))).toBeNull();
    expect(advanceMarker(items, '90', seen('105', '104', '103', '102', '101', '100'))).toBeNull();
    expect(advanceMarker(items, '105', seen('105'))).toBeNull();
  });
});

describe('skippedBetween (newest first)', () => {
  const items = ['110', '109', '108', '107', '106', '105'].map((id) => ({ id }));

  it('returns the posts a quick scroll upwards flew past', () => {
    expect(skippedBetween(items, ['106', '105'], ['109', '108'])).toEqual(['107']);
  });
  it('returns nothing when scrolling down, staying put or overlapping', () => {
    expect(skippedBetween(items, ['109', '108'], ['106', '105'])).toEqual([]);
    expect(skippedBetween(items, ['108', '107'], ['108', '107'])).toEqual([]);
    expect(skippedBetween(items, ['107', '106'], ['108', '107'])).toEqual([]);
  });
  it('returns nothing for a jump longer than maxGap, or without a previous look', () => {
    expect(skippedBetween(items, ['105'], ['110'], 3)).toEqual([]);
    expect(skippedBetween(items, [], ['110'])).toEqual([]);
  });
});
