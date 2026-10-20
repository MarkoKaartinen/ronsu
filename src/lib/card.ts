import type { Status } from './api/types';
import { safeHttpUrl } from './url';

/** A link preview ready to show: every address has been through `safeHttpUrl` and every text is plain text */
export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  provider: string;
  image: string | null;
  imageAlt: string;
}

/**
 * The preview of a post's link, or null when there is nothing worth showing. Like other clients, a post with
 * pictures, a poll or a quote has no preview (they already carry the attention). A card needs a safe address and
 * a title; the picture is left out when its address is not safe.
 */
export function linkPreview(status: Status): LinkPreview | null {
  const card = status.card;
  if (!card || status.media_attachments.length || status.poll || status.quote) return null;
  const url = safeHttpUrl(card.url);
  const title = typeof card.title === 'string' ? card.title.trim() : '';
  if (!url || !title) return null;
  return {
    url,
    title,
    description: typeof card.description === 'string' ? card.description.trim() : '',
    provider: typeof card.provider_name === 'string' && card.provider_name.trim() ? card.provider_name.trim() : new URL(url).hostname,
    image: safeHttpUrl(card.image),
    imageAlt: typeof card.image_description === 'string' ? card.image_description : '',
  };
}
