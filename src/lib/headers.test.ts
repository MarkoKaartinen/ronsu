import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import readme from '../../README.md?raw';

/** The policy of the meta element in index.html */
const metaPolicy = () => /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(indexHtml)![1].replace(/\s+/g, ' ').trim();

describe('Content-Security-Policy', () => {
  it('the policy in the README header examples is the one in index.html plus frame-ancestors', () => {
    const expected = `${metaPolicy()}; frame-ancestors 'none'`;
    // Every copy of the header (plain, nginx, Apache, Caddy) says exactly this
    const copies = readme.split(expected).length - 1;
    expect(copies).toBeGreaterThanOrEqual(4);
  });

  it('the meta element keeps the restrictions the app relies on, and has no frame-ancestors (a browser ignores it there)', () => {
    const policy = metaPolicy();
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(/script-src[^;]*/.exec(policy)![0]).not.toMatch(/unsafe|https:|\*/);
    expect(policy).not.toContain('frame-ancestors');
  });
});
