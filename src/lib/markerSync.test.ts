import { describe, expect, it } from 'vitest';
import { isForeignUpdate, parsePos, pickStart } from './markerSync';

describe('parsePos', () => {
  it('reads the JSON format and the old bare id', () => {
    expect(parsePos('{"id":"5","at":100}')).toEqual({ id: '5', at: 100 });
    expect(parsePos('123')).toEqual({ id: '123', at: 0 });
    expect(parsePos('roskaa')).toBeNull();
    expect(parsePos(null)).toBeNull();
  });
});

describe('pickStart', () => {
  it('the newer time wins, even for an older id', () => {
    expect(pickStart({ id: '50', at: 200 }, { id: '90', at: 100 })).toEqual({ id: '50', at: 200 });
    expect(pickStart({ id: '50', at: 100 }, { id: '90', at: 200 })).toEqual({ id: '90', at: 200 });
  });
  it('uses whichever exists', () => {
    expect(pickStart(null, { id: '1', at: 1 })).toEqual({ id: '1', at: 1 });
    expect(pickStart({ id: '1', at: 1 }, null)).toEqual({ id: '1', at: 1 });
  });
});

describe('isForeignUpdate', () => {
  const seen = { id: '10', at: 100 };
  it('recognises a newer update from another device', () => {
    expect(isForeignUpdate({ id: '20', at: 300 }, seen, { id: '10', at: 150 })).toBe(true);
  });
  it('does not alert on our own save (the server state is unchanged)', () => {
    expect(isForeignUpdate(seen, seen, { id: '12', at: 150 })).toBe(false);
  });
  it('our own later move wins', () => {
    expect(isForeignUpdate({ id: '20', at: 200 }, seen, { id: '5', at: 250 })).toBe(false);
  });
  it('the same position is not an update', () => {
    expect(isForeignUpdate({ id: '20', at: 300 }, seen, { id: '20', at: 100 })).toBe(false);
  });
});
