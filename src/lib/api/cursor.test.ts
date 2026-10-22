import { describe, expect, it } from 'vitest';
import { cursorOf } from './client';

describe('cursorOf', () => {
  it('reads max_id from the next link of the Link header, wherever it stands among the parameters', () => {
    expect(cursorOf('https://mastodon.example/api/v1/bookmarks?limit=20&max_id=7163058')).toBe('7163058');
    expect(cursorOf('https://mastodon.example/api/v1/bookmarks?max_id=7163058&limit=20')).toBe('7163058');
  });
  it('is undefined on the last page or a link it cannot read', () => {
    expect(cursorOf(null)).toBeUndefined();
    expect(cursorOf('https://mastodon.example/api/v1/bookmarks?limit=20')).toBeUndefined();
    expect(cursorOf('not a url')).toBeUndefined();
  });
});
