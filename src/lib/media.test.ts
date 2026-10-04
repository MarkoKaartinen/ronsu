import { describe, expect, it } from 'vitest';
import { mediaAspect } from './media';
import type { MediaAttachment } from './api/types';

const m = (meta: MediaAttachment['meta']): MediaAttachment => ({
  id: '1', type: 'image', url: '', preview_url: '', description: null, meta,
});

describe('mediaAspect', () => {
  it('uses the aspect ratio of the small meta', () => {
    expect(mediaAspect(m({ small: { aspect: 1.5 }, original: { aspect: 2 } }), true)).toBe(1.5);
  });
  it('computes it from width and height if aspect is missing', () => {
    expect(mediaAspect(m({ original: { width: 800, height: 400 } }), true)).toBe(2);
  });
  it('returns the fallback aspect ratio when there is no meta', () => {
    expect(mediaAspect(m(null), true)).toBeCloseTo(16 / 9);
  });
  it('in a grid the cells are square', () => {
    expect(mediaAspect(m({ small: { aspect: 3 } }), false)).toBe(1);
  });
});
