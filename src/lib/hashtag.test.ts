import { describe, expect, it } from 'vitest';
import { splitTrailingTags, tagNamed } from './hashtag';

const tags = [
  { name: 'ronsu', url: 'https://mastodon.example/tags/ronsu' },
  { name: 'äänet', url: 'https://mastodon.example/tags/äänet' },
];

describe('tagNamed', () => {
  it('finds the hashtag by the name written in the link, with or without the #', () => {
    expect(tagNamed(tags, '#ronsu')?.name).toBe('ronsu');
    expect(tagNamed(tags, 'ronsu')?.name).toBe('ronsu');
  });

  it('ignores the case, as the author may have written the name otherwise', () => {
    expect(tagNamed(tags, '#Ronsu')?.name).toBe('ronsu');
    expect(tagNamed(tags, '#ÄÄNET')?.name).toBe('äänet');
  });

  it('ignores a name that is not one of the hashtags of the post', () => {
    expect(tagNamed(tags, '#other')).toBeUndefined();
    expect(tagNamed(tags, '#')).toBeUndefined();
    expect(tagNamed(undefined, '#ronsu')).toBeUndefined();
  });
});

describe('splitTrailingTags', () => {
  // As in a post from another server: its own address for the hashtag, and the name as its author wrote it
  const link = (name: string) => `<a href="https://remote.example/tags/${name}" class="mention hashtag" rel="tag">#<span>${name}</span></a>`;
  const both = [tags[0], { name: 'mastodon', url: 'https://mastodon.example/tags/mastodon' }];

  it('takes a last paragraph of only hashtags out of the text and into the bar', () => {
    const out = splitTrailingTags(`<p>Hello</p><p>${link('ronsu')} ${link('mastodon')}</p>`, both);
    expect(out.html).toBe('<p>Hello</p>');
    expect(out.bar.map((tag) => tag.name)).toEqual(['ronsu', 'mastodon']);
  });

  it('takes line breaks between the hashtags too', () => {
    expect(splitTrailingTags(`<p>Hello</p><p>${link('ronsu')}<br />${link('mastodon')}</p>`, both).html).toBe('<p>Hello</p>');
  });

  it('leaves hashtags inside a sentence where they are', () => {
    const html = `<p>Hello ${link('ronsu')}</p>`;
    expect(splitTrailingTags(html, [tags[0]])).toEqual({ html, bar: [] });
  });

  it('leaves a post that is only hashtags as it is', () => {
    const html = `<p>${link('ronsu')}</p>`;
    expect(splitTrailingTags(html, [tags[0]])).toEqual({ html, bar: [] });
  });

  it('leaves a last paragraph that ends in something that is not a hashtag of the post', () => {
    for (const last of [`${link('ronsu')} nice`, `${link('ronsu')} ${link('other')}`, `${link('ronsu')} <a href="https://mastodon.example/@a" class="u-url mention">@a</a>`]) {
      const html = `<p>Hello</p><p>${last}</p>`;
      expect(splitTrailingTags(html, both).html).toBe(html);
    }
  });

  it('takes the hashtags that end a paragraph of text and links too', () => {
    const url = '<a href="https://example.org/a" target="_blank" rel="nofollow noopener"><span class="invisible">https://</span><span>example.org/a</span></a>';
    const out = splitTrailingTags(`<p>${url} ${link('ronsu')} ${link('mastodon')}</p>`, both);
    expect(out.html).toBe(`<p>${url}</p>`);
    expect(out.bar.map((tag) => tag.name)).toEqual(['ronsu', 'mastodon']);
    expect(splitTrailingTags(`<p>Hello</p><p>Nice view!<br />${link('ronsu')} ${link('mastodon')}</p>`, both).html).toBe('<p>Hello</p><p>Nice view!</p>');
  });

  it('takes the hashtags that come before a link at the end, and leaves the link', () => {
    const url = '<a href="https://example.org/a" target="_blank" rel="nofollow noopener"><span class="invisible">https://</span><span>example.org/a</span></a>';
    const out = splitTrailingTags(`<p>Hello</p><p>${link('ronsu')} ${link('mastodon')}<br />${url}</p>`, both);
    expect(out.html).toBe(`<p>Hello</p><p>${url}</p>`);
    expect(out.bar.map((tag) => tag.name)).toEqual(['ronsu', 'mastodon']);
    expect(splitTrailingTags(`<p>${link('ronsu')}<br />${url}</p>`, [tags[0]]).html).toBe(`<p>${url}</p>`);
    expect(splitTrailingTags(`<p>Look: ${link('ronsu')} ${link('mastodon')}<br />${url}</p>`, both).html).toBe(`<p>Look:<br />${url}</p>`);
  });

  it('leaves hashtags that are followed by a mention or by text', () => {
    const mention = '<a href="https://mastodon.example/@a" class="u-url mention">@a</a>';
    for (const after of [mention, 'thanks']) {
      const html = `<p>Hello</p><p>${link('ronsu')} ${link('mastodon')}<br />${after}</p>`;
      expect(splitTrailingTags(html, both).html).toBe(html);
    }
  });

  it('leaves a single hashtag after text, as it may be part of the sentence', () => {
    const html = `<p>I love ${link('ronsu')}</p>`;
    expect(splitTrailingTags(html, [tags[0]])).toEqual({ html, bar: [] });
  });

  it('leaves the hashtags in the middle of the text', () => {
    const html = `<p>Today ${link('ronsu')} ${link('mastodon')} is fun, says me.</p>`;
    expect(splitTrailingTags(html, both)).toEqual({ html, bar: [] });
  });

  it('does not take a hashtag out of a quote or a list at the end', () => {
    const html = `<p>Hello</p><blockquote><p>${link('ronsu')} ${link('mastodon')}</p></blockquote>`;
    expect(splitTrailingTags(html, both).html).toBe(html);
  });

  it('adds the hashtags of the post that the text does not link', () => {
    const out = splitTrailingTags('<p>Hello</p>', both);
    expect(out.bar.map((tag) => tag.name)).toEqual(['ronsu', 'mastodon']);
    expect(splitTrailingTags(`<p>Hello ${link('ronsu')}</p>`, both).bar.map((tag) => tag.name)).toEqual(['mastodon']);
  });

  it('does not show a hashtag twice, whatever its case', () => {
    const out = splitTrailingTags(`<p>Hello</p><p>${link('RONSU')}</p>`, [tags[0], { name: 'Ronsu', url: 'https://mastodon.example/tags/Ronsu' }]);
    expect(out.bar).toHaveLength(1);
  });

  it('does nothing for a post without hashtags', () => {
    expect(splitTrailingTags('<p>Hello</p>', undefined)).toEqual({ html: '<p>Hello</p>', bar: [] });
    expect(splitTrailingTags('<p>Hello</p>', [])).toEqual({ html: '<p>Hello</p>', bar: [] });
  });
});
