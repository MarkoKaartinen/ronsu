import { describe, expect, it } from 'vitest';
import { allAlerts, defaultPrefs, keyToBase64, parsePrefs, PUSH_TYPES, readAlerts, sameKey, vapidKeyBytes } from './pushLogic';

describe('parsePrefs', () => {
  it('starts quiet for favorites and boosts, with a sound for the rest and the badge on', () => {
    const prefs = parsePrefs(null);
    expect(prefs.sound.mention).toBe(true);
    expect(prefs.sound.favourite).toBe(false);
    expect(prefs.sound.reblog).toBe(false);
    expect(prefs.badge).toBe(true);
    expect(Object.keys(prefs.sound).sort()).toEqual([...PUSH_TYPES].sort());
  });

  it('keeps what was stored and fills in the rest', () => {
    const prefs = parsePrefs({ sound: { mention: false, favourite: true }, badge: false, policy: { 'mock.test|1': 'followed' } });
    expect(prefs.sound.mention).toBe(false);
    expect(prefs.sound.favourite).toBe(true);
    expect(prefs.sound.follow).toBe(true);
    expect(prefs.badge).toBe(false);
    expect(prefs.policy['mock.test|1']).toBe('followed');
  });

  it('ignores values of the wrong kind', () => {
    const prefs = parsePrefs({ sound: { mention: 'yes' }, badge: 1, policy: { a: 'everyone', b: 'none' } });
    expect(prefs).toEqual({ ...defaultPrefs(), policy: { b: 'none' } });
    expect(parsePrefs('nonsense')).toEqual(defaultPrefs());
  });
});

describe('alerts', () => {
  it('a type the server does not mention is off', () => {
    const alerts = readAlerts({ mention: true, favourite: false });
    expect(alerts.mention).toBe(true);
    expect(alerts.favourite).toBe(false);
    expect(alerts.poll).toBe(false);
    expect(Object.keys(alerts).sort()).toEqual([...PUSH_TYPES].sort());
  });

  it('all of them are on for the first subscription', () => {
    expect(Object.values(allAlerts()).every(Boolean)).toBe(true);
  });
});

describe('keys', () => {
  it('turns a URL-safe VAPID key into bytes and compares it with the browser\'s', () => {
    const bytes = vapidKeyBytes('AQID_w'); // 01 02 03 ff
    expect([...bytes]).toEqual([1, 2, 3, 255]);
    expect(sameKey(bytes.buffer, bytes)).toBe(true);
    expect(sameKey(new Uint8Array([1, 2, 3, 254]).buffer, bytes)).toBe(false);
    expect(sameKey(null, bytes)).toBe(false);
  });

  it('writes a subscription key as standard base64', () => {
    expect(keyToBase64(new Uint8Array([1, 2, 3, 255]).buffer)).toBe('AQID/w==');
    expect(keyToBase64(null)).toBe('');
  });
});
