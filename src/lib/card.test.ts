import { describe, expect, it } from 'vitest';
import { linkPreview } from './card';
import type { PreviewCard, Status } from './api/types';

const card = (over: Partial<PreviewCard> = {}): PreviewCard => ({
  url: 'https://news.example/story',
  title: ' A story ',
  description: 'About a thing',
  type: 'link',
  provider_name: 'News',
  image: 'https://news.example/a.png',
  ...over,
});
const st = (c: PreviewCard | null | undefined, over: Partial<Status> = {}) => ({ card: c, media_attachments: [], ...over }) as unknown as Status;

describe('linkPreview', () => {
  it('is null without a card', () => {
    expect(linkPreview(st(null))).toBeNull();
    expect(linkPreview(st(undefined))).toBeNull();
  });
  it('trims the texts and keeps the safe addresses', () => {
    expect(linkPreview(st(card()))).toEqual({
      url: 'https://news.example/story',
      title: 'A story',
      description: 'About a thing',
      provider: 'News',
      image: 'https://news.example/a.png',
      imageAlt: '',
    });
  });
  it('falls back to the host of the link when the provider has no name', () => {
    expect(linkPreview(st(card({ provider_name: '' })))?.provider).toBe('news.example');
  });
  it('is null without a title', () => {
    expect(linkPreview(st(card({ title: '  ' })))).toBeNull();
  });
  it('is null for an address that is not http or https', () => {
    expect(linkPreview(st(card({ url: 'javascript:alert(1)' })))).toBeNull();
  });
  it('drops a picture whose address is not safe, and keeps the card', () => {
    const p = linkPreview(st(card({ image: 'data:image/png;base64,AAAA' })));
    expect(p?.image).toBeNull();
    expect(p?.title).toBe('A story');
  });
  it('passes the alt text of the picture on', () => {
    expect(linkPreview(st(card({ image_description: 'A harbour' })))?.imageAlt).toBe('A harbour');
  });
  it('is null on a post with pictures, a poll or a quote', () => {
    expect(linkPreview(st(card(), { media_attachments: [{}] as Status['media_attachments'] }))).toBeNull();
    expect(linkPreview(st(card(), { poll: {} as Status['poll'] }))).toBeNull();
    expect(linkPreview(st(card(), { quote: { state: 'accepted', quoted_status: null } }))).toBeNull();
  });
});
