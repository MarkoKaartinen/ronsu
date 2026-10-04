import type { MediaAttachment } from './api/types';

const FALLBACK_ASPECT = 16 / 9;

/**
 * Aspect ratio (width / height) used to reserve space before the media loads. Without reserved space
 * the loading image pushes content around and the list "jumps". Several attachments are shown in a
 * grid of square cells.
 */
export function mediaAspect(m: MediaAttachment, single: boolean): number {
  if (!single) return 1;
  const meta = m.meta?.small ?? m.meta?.original;
  if (meta?.aspect && meta.aspect > 0) return meta.aspect;
  if (meta?.width && meta?.height) return meta.width / meta.height;
  return FALLBACK_ASPECT;
}
