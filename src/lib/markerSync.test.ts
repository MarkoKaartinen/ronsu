import { describe, expect, it } from 'vitest';
import { clockOffset, isForeignUpdate, parsePos, pickStart } from './markerSync';

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

describe("isForeignUpdate with the server's version counter", () => {
  const seen = { id: '10', at: 100, version: 4 };
  it('a higher version is another device even when our clock is ahead of the server', () => {
    // Our clock says we moved at 9000, the server's time stamp of their update is only 300: times alone would say "ours"
    expect(isForeignUpdate({ id: '20', at: 300, version: 5 }, seen, { id: '10', at: 9000 })).toBe(true);
  });
  it('the same version is not an update, whatever the time stamps say', () => {
    expect(isForeignUpdate({ id: '20', at: 99999, version: 4 }, seen, { id: '10', at: 150 })).toBe(false);
  });
  it('when we have moved too (unsent), the time stamps decide again', () => {
    expect(isForeignUpdate({ id: '20', at: 300, version: 5 }, seen, { id: '15', at: 500 })).toBe(false);
    expect(isForeignUpdate({ id: '20', at: 600, version: 5 }, seen, { id: '15', at: 500 })).toBe(true);
  });
  it('falls back to the time stamps when there are no versions', () => {
    expect(isForeignUpdate({ id: '20', at: 300 }, { id: '10', at: 100 }, { id: '10', at: 150 })).toBe(true);
  });
});

describe('clockOffset', () => {
  it('is the server time minus the device time', () => {
    expect(clockOffset('2026-10-04T10:00:00.000Z', Date.parse('2026-10-04T10:10:00.000Z'))).toBe(-600_000); // phone 10 min ahead
    expect(clockOffset('2026-10-04T10:10:00.000Z', Date.parse('2026-10-04T10:00:00.000Z'))).toBe(600_000); // phone 10 min behind
  });
  it('is 0 for an invalid time stamp', () => {
    expect(clockOffset('nonsense', 1000)).toBe(0);
  });
});
