import { describe, expect, it, vi } from 'vitest';
import { compareIds, saveHomeMarker } from './markers';
import type { MastodonClient } from './client';

describe('compareIds', () => {
  it('compares numeric snowflake ids by length', () => {
    expect(compareIds('99', '100')).toBeLessThan(0);
    expect(compareIds('110000', '109999')).toBeGreaterThan(0);
    expect(compareIds('123', '123')).toBe(0);
  });
});

describe('saveHomeMarker', () => {
  const marker = { last_read_id: '200', version: 1, updated_at: '2026-10-04T08:00:00.000Z' };
  const makeClient = () =>
    ({ post: vi.fn().mockResolvedValue({ home: marker }) }) as unknown as MastodonClient & {
      post: ReturnType<typeof vi.fn>;
    };

  it("writes and returns the server's marker", async () => {
    const c = makeClient();
    expect(await saveHomeMarker(c, '200', '100')).toEqual(marker);
    expect(c.post).toHaveBeenCalledWith('/api/v1/markers', { home: { last_read_id: '200' } }, {}, { keepalive: false });
  });

  it('also writes backwards (the position follows the reader)', async () => {
    const c = makeClient();
    expect(await saveHomeMarker(c, '100', '200')).toEqual(marker);
    expect(c.post).toHaveBeenCalled();
  });

  it('skips the save when the server already has the same id', async () => {
    const c = makeClient();
    expect(await saveHomeMarker(c, '100', '100')).toBeNull();
    expect(c.post).not.toHaveBeenCalled();
  });

  it('writes when the server has no position', async () => {
    const c = makeClient();
    expect(await saveHomeMarker(c, '5', null)).toEqual(marker);
  });
});
