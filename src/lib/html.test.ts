import { describe, expect, it } from 'vitest';
import { escapeHtml, replaceEmojis } from './html';

describe('replaceEmojis', () => {
  const emojis = [{ shortcode: 'blobcat', url: 'https://x/a.png', static_url: 'https://x/a_static.png' }];

  it('replaces a known shortcode with an image', () => {
    expect(replaceEmojis('hi :blobcat:', emojis)).toContain('<img class="emoji" src="https://x/a_static.png"');
  });
  it('leaves an unknown one as is', () => {
    expect(replaceEmojis('hi :unknown:', emojis)).toBe('hi :unknown:');
  });
  it('does nothing without emojis', () => {
    expect(replaceEmojis('at 12:30:45', undefined)).toBe('at 12:30:45');
  });
});

describe('escapeHtml', () => {
  it('escapes special characters', () => {
    expect(escapeHtml('<b>"&"</b>')).toBe('&lt;b&gt;&quot;&amp;&quot;&lt;/b&gt;');
  });
});
