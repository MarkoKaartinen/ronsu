import { describe, expect, it } from 'vitest';
import { filterVerdict } from './filters';
import type { FilterContext, Status } from './api/types';

const match = (title: string, filter_action: string, context: FilterContext[] = ['home'], expires_at: string | null = null) => ({
  filter: { id: title, title, context, expires_at, filter_action },
});
const st = (filtered?: ReturnType<typeof match>[], reblog?: Status) => ({ filtered, reblog }) as unknown as Status;

describe('filterVerdict', () => {
  it('is null without a matching filter', () => {
    expect(filterVerdict(st(), 'home')).toBeNull();
    expect(filterVerdict(st([]), 'home')).toBeNull();
  });
  it('names the filter by its title', () => {
    expect(filterVerdict(st([match('Spoilers', 'warn')]), 'home')).toEqual({ action: 'warn', titles: ['Spoilers'] });
  });
  it('ignores a filter that does not apply in this view', () => {
    const s = st([match('Spoilers', 'hide', ['notifications'])]);
    expect(filterVerdict(s, 'home')).toBeNull();
    expect(filterVerdict(s, 'notifications')?.action).toBe('hide');
  });
  it('ignores an expired filter', () => {
    const now = Date.parse('2026-10-20T12:00:00Z');
    expect(filterVerdict(st([match('Old', 'hide', ['home'], '2026-10-20T11:00:00Z')]), 'home', now)).toBeNull();
    expect(filterVerdict(st([match('New', 'hide', ['home'], '2026-10-20T13:00:00Z')]), 'home', now)?.action).toBe('hide');
  });
  it('hide beats warn, and warn beats blur', () => {
    expect(filterVerdict(st([match('a', 'warn'), match('b', 'hide')]), 'home')).toEqual({ action: 'hide', titles: ['b'] });
    expect(filterVerdict(st([match('a', 'blur'), match('b', 'warn')]), 'home')).toEqual({ action: 'warn', titles: ['b'] });
  });
  it('lists every title with the winning action once', () => {
    expect(filterVerdict(st([match('a', 'warn'), match('b', 'warn'), match('a', 'warn')]), 'home')?.titles).toEqual(['a', 'b']);
  });
  it('treats an unknown action as warn', () => {
    expect(filterVerdict(st([match('a', 'sparkle')]), 'home')?.action).toBe('warn');
  });
  it('reads the filters of the boosted post too', () => {
    expect(filterVerdict(st(undefined, st([match('a', 'blur')])), 'home')).toEqual({ action: 'blur', titles: ['a'] });
  });
});
