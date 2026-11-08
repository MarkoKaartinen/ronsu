import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, findConflict, keyName, matchKey, parseBindings, serializeBindings, SHORTCUT_ACTIONS, validBinding } from './shortcuts';

describe('defaults', () => {
  it('have no collisions', () => {
    for (const a of SHORTCUT_ACTIONS) expect(findConflict(DEFAULT_BINDINGS, a.id, a.default)).toBeNull();
  });

  it('follow Mastodon', () => {
    expect(DEFAULT_BINDINGS).toMatchObject({ down: 'j', up: 'k', reply: 'r', boost: 'b', favourite: 'f', openThread: 'o', openProfile: 'p', newPost: 'n', back: 'Backspace', help: '?' });
  });
});

describe('keyName', () => {
  it('names the keys as typed', () => {
    expect(keyName({ key: 'j' })).toBe('j');
    expect(keyName({ key: 'L' })).toBe('L');
    expect(keyName({ key: ' ' })).toBe('Space');
  });
  it('leaves out modifiers, Escape, Tab and Ctrl, Alt or Meta combinations', () => {
    expect(keyName({ key: 'Shift' })).toBeNull();
    expect(keyName({ key: 'Escape' })).toBeNull();
    expect(keyName({ key: 'Tab' })).toBeNull();
    expect(keyName({ key: 'r', ctrlKey: true })).toBeNull();
    expect(keyName({ key: 'r', metaKey: true })).toBeNull();
    expect(keyName({ key: 'r', altKey: true })).toBeNull();
  });
});

describe('validBinding', () => {
  it('takes nothing, one key or two', () => {
    expect(validBinding('')).toBe(true);
    expect(validBinding('j')).toBe(true);
    expect(validBinding('g h')).toBe(true);
    expect(validBinding('g h i')).toBe(false);
    expect(validBinding('g  h')).toBe(false);
    expect(validBinding('Escape')).toBe(false);
    expect(validBinding(5)).toBe(false);
  });
});

describe('findConflict', () => {
  it('finds the same key and a key that is the start of a two-key one', () => {
    expect(findConflict(DEFAULT_BINDINGS, 'down', 'k')).toBe('up');
    expect(findConflict(DEFAULT_BINDINGS, 'down', 'g')).not.toBeNull();
    expect(findConflict(DEFAULT_BINDINGS, 'goHome', 'j')).toBe('down');
    expect(findConflict(DEFAULT_BINDINGS, 'down', 'j')).toBeNull(); // its own
    expect(findConflict(DEFAULT_BINDINGS, 'down', 'z')).toBeNull();
    expect(findConflict(DEFAULT_BINDINGS, 'down', '')).toBeNull();
  });
});

describe('matchKey', () => {
  it('finds an action by one key', () => {
    expect(matchKey(DEFAULT_BINDINGS, [], 'j')).toEqual({ action: 'down', pending: [] });
    expect(matchKey(DEFAULT_BINDINGS, [], 'l')).toEqual({ action: 'loadOlder', pending: [] });
    expect(matchKey(DEFAULT_BINDINGS, [], 'z')).toEqual({ action: null, pending: [] });
  });
  it('waits for the second key and finds the action', () => {
    expect(matchKey(DEFAULT_BINDINGS, [], 'g')).toEqual({ action: null, pending: ['g'] });
    expect(matchKey(DEFAULT_BINDINGS, ['g'], 'n')).toEqual({ action: 'goNotifications', pending: [] });
  });
  it('starts over with a wrong second key, which may be a shortcut itself', () => {
    expect(matchKey(DEFAULT_BINDINGS, ['g'], 'j')).toEqual({ action: 'down', pending: [] });
    expect(matchKey(DEFAULT_BINDINGS, ['g'], 'z')).toEqual({ action: null, pending: [] });
  });
  it('does not react to a switched off action', () => {
    expect(matchKey({ ...DEFAULT_BINDINGS, down: '' }, [], 'j')).toEqual({ action: null, pending: [] });
  });
});

describe('saving', () => {
  it('saves only the changes', () => {
    expect(serializeBindings(DEFAULT_BINDINGS)).toBe('{}');
    expect(serializeBindings({ ...DEFAULT_BINDINGS, down: 'n', newPost: '' })).toBe('{"down":"n","newPost":""}');
  });
  it('restores the changes on top of the defaults', () => {
    expect(parseBindings(null)).toEqual(DEFAULT_BINDINGS);
    expect(parseBindings('{"reply":"y"}')).toEqual({ ...DEFAULT_BINDINGS, reply: 'y' });
    expect(parseBindings('{"reply":""}').reply).toBe('');
  });
  it('restores two actions that swapped their keys', () => {
    expect(parseBindings('{"down":"k","up":"j"}')).toEqual({ ...DEFAULT_BINDINGS, down: 'k', up: 'j' });
  });
  it('ignores what is broken, unknown or taken', () => {
    expect(parseBindings('not json')).toEqual(DEFAULT_BINDINGS);
    expect(parseBindings('[1]')).toEqual(DEFAULT_BINDINGS);
    expect(parseBindings('{"nope":"x","reply":"Escape","boost":5}')).toEqual(DEFAULT_BINDINGS);
    // "f" is the favorite key: reply cannot have it and keeps its default
    expect(parseBindings('{"reply":"f"}')).toEqual(DEFAULT_BINDINGS);
  });
});
