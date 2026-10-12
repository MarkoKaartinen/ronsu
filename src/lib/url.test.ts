import { describe, expect, it } from 'vitest';
import { safeHttpUrl } from './url';

describe('safeHttpUrl', () => {
  it('lets web addresses through, normalized', () => {
    expect(safeHttpUrl('https://mastodon.social/@a/1')).toBe('https://mastodon.social/@a/1');
    expect(safeHttpUrl('  http://example.org  ')).toBe('http://example.org/');
    expect(safeHttpUrl('HTTPS://Example.org/Path')).toBe('https://example.org/Path');
  });

  it('refuses every other protocol', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'blob:https://example.org/uuid',
      'ftp://example.org/x',
      'mailto:a@example.org',
      'tel:+358401234567',
      'intent://scan/#Intent;scheme=zxing;end',
      'vbscript:msgbox(1)',
      'ronsu://logout',
    ]) {
      expect(safeHttpUrl(bad), bad).toBeNull();
    }
  });

  it('refuses a protocol hidden behind control characters, spaces or line breaks', () => {
    for (const bad of ['java\tscript:alert(1)', 'java\nscript:alert(1)', '\u0001javascript:alert(1)', 'https://example.org/\u0000', ' \n ']) {
      expect(safeHttpUrl(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('refuses things that are not addresses', () => {
    for (const bad of ['', '   ', 'not a url', '/relative/path', '//example.org/x', 'https://', undefined, null, 42, {}, []]) {
      expect(safeHttpUrl(bad), String(bad)).toBeNull();
    }
  });
});
