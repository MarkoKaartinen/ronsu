import { describe, expect, it } from 'vitest';
import { countUse, customGroups, filterGroups, FREQUENT_LIMIT, frequentGroup, insertEmoji, unicodeGroups } from './emojiLogic';

const custom = (shortcode: string, category: string | null = null, visible_in_picker = true) => ({ shortcode, url: '', static_url: `https://mastodon.example/${shortcode}.png`, category, visible_in_picker });

describe('customGroups', () => {
  const list = [custom('party', 'Fun'), custom('blobcat'), custom('blobhaj', 'Fun'), custom('zebra', 'Animals'), custom('secret', null, false)];

  it('groups by category, the uncategorised first, and sorts by shortcode', () => {
    expect(customGroups(list, 'Custom').map((g) => [g.title, g.emojis.map((x) => x.id)])).toEqual([
      ['Custom', [':blobcat:']],
      ['Animals', [':zebra:']],
      ['Fun', [':blobhaj:', ':party:']],
    ]);
  });

  it('leaves out emoji the server does not want in the picker', () => {
    expect(customGroups(list, 'Custom').flatMap((g) => g.emojis.map((e) => e.id))).not.toContain(':secret:');
  });
});

describe('unicodeGroups', () => {
  const data = [
    { unicode: '🐶', label: 'koiran naama', tags: ['koira'], group: 3, order: 5 },
    { unicode: '😀', label: 'hymy', tags: ['iloinen'], group: 0, order: 2 },
    { unicode: '😃', label: 'iso hymy', group: 0, order: 1 },
    { unicode: '🏻', label: 'vaalea iho', group: 2, order: 3 },
    { unicode: '🇦', label: 'alueellinen indikaattori A', order: 4 },
  ];

  it('groups in the order of the data, leaves out the components and what has no group, and capitalizes titles', () => {
    const groups = unicodeGroups(data, { 0: 'hymiöt', 3: 'eläimet' });
    expect(groups.map((g) => [g.title, g.emojis.map((e) => e.id)])).toEqual([
      ['Hymiöt', ['😃', '😀']],
      ['Eläimet', ['🐶']],
    ]);
  });

  it('makes the label and the tags searchable', () => {
    const search = unicodeGroups(data, {})[0].emojis[1].search;
    expect(search).toContain('hymy');
    expect(search).toContain('iloinen');
  });
});

describe('filterGroups', () => {
  const groups = [...customGroups([custom('blobcat'), custom('party', 'Fun')], 'Custom'), ...unicodeGroups([{ unicode: '🐱', label: 'Cat face', tags: ['pet'], group: 3, order: 1 }], { 3: 'animals' })];

  it('keeps everything when nothing is searched', () => {
    expect(filterGroups(groups, '  ')).toBe(groups);
  });

  it('searches names and tags, ignoring case and colons, and drops empty groups', () => {
    expect(filterGroups(groups, ':BLOB:').map((g) => g.emojis.map((e) => e.id))).toEqual([[':blobcat:']]);
    expect(filterGroups(groups, 'pet').map((g) => g.emojis.map((e) => e.id))).toEqual([['🐱']]);
    expect(filterGroups(groups, 'nothing')).toEqual([]);
  });
});

describe('frequentGroup', () => {
  const groups = customGroups([custom('a'), custom('b'), custom('c')], 'Custom');

  it('lists the most used first and leaves out emoji that are not available', () => {
    const use = countUse(countUse(countUse({ ':gone:': 9 }, ':b:'), ':c:'), ':b:');
    expect(frequentGroup(groups, use, 'Frequent')?.emojis.map((e) => e.id)).toEqual([':b:', ':c:']);
  });

  it('is null when nothing has been used', () => {
    expect(frequentGroup(groups, {}, 'Frequent')).toBeNull();
  });

  it('shows at most FREQUENT_LIMIT', () => {
    const many = customGroups(Array.from({ length: FREQUENT_LIMIT + 5 }, (_, i) => custom(`e${i}`)), 'Custom');
    const use = Object.fromEntries(many[0].emojis.map((e) => [e.id, 1]));
    expect(frequentGroup(many, use, 'Frequent')?.emojis).toHaveLength(FREQUENT_LIMIT);
  });
});

describe('insertEmoji', () => {
  const cat = { id: ':blobcat:', label: ':blobcat:', search: '', url: 'x' };
  const face = { id: '😀', label: 'hymy', search: '', unicode: '😀' };

  it('puts a custom emoji at the cursor with spaces around it', () => {
    expect(insertEmoji('Hi there', 2, 2, cat)).toEqual({ text: 'Hi :blobcat: there', cursor: 13 });
  });

  it('adds no space at the start or after a space, and replaces a selection', () => {
    expect(insertEmoji('', 0, 0, cat)).toEqual({ text: ':blobcat: ', cursor: 10 });
    expect(insertEmoji('Hi  x', 3, 5, cat)).toEqual({ text: 'Hi :blobcat: ', cursor: 13 });
  });

  it('puts a Unicode emoji in as it is', () => {
    expect(insertEmoji('Hi there', 2, 2, face)).toEqual({ text: 'Hi😀 there', cursor: 4 });
  });
});
