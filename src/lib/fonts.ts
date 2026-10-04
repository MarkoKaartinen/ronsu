/**
 * The fonts the reader can choose from (settings). Like the themes they are data: a new font = a new entry
 * here, its @font-face rules in src/fonts.css (or an import in main.ts), and a preview/name in the settings.
 * The CSS variable `--font` per font is generated at build time, and a small script sets the choice before
 * the first paint (vite.config.ts), so there is no flash of the wrong font.
 */
export interface FontOption {
  id: string;
  /** Shown as is (a font's name is never translated); null = the system font, named by the UI language */
  name: string | null;
  /** The CSS font-family stack */
  stack: string;
}

const SANS_FALLBACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const FONTS: FontOption[] = [
  { id: 'figtree', name: 'Figtree', stack: `'Figtree Variable', ${SANS_FALLBACK}` },
  { id: 'inter', name: 'Inter', stack: `'Inter Variable', ${SANS_FALLBACK}` },
  { id: 'open-sans', name: 'Open Sans', stack: `'Open Sans Variable', ${SANS_FALLBACK}` },
  { id: 'jetbrains-mono', name: 'JetBrains Mono', stack: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
  { id: 'system', name: null, stack: SANS_FALLBACK },
];

export const DEFAULT_FONT = 'figtree';
export const FONT_KEY = 'font';

/** A stored value if it is a known font, otherwise the default. */
export function parseFont(raw: string | null, fonts: FontOption[] = FONTS): string {
  return fonts.some((f) => f.id === raw) ? (raw as string) : DEFAULT_FONT;
}

/**
 * `--font` for each font, applied through the `data-font` attribute on <html>. The selector is `:root[...]` so it
 * outranks the default `--font` in app.css, which is loaded later.
 */
export function fontCss(fonts: FontOption[] = FONTS): string {
  return fonts.map((f) => `:root[data-font="${f.id}"]{--font:${f.stack}}`).join('\n');
}

/** Script that runs before the first paint (external file, the CSP does not allow inline scripts). */
export function fontInitScript(fonts: FontOption[] = FONTS): string {
  const ids = JSON.stringify(fonts.map((f) => f.id));
  return `(function(){try{
var ids=${ids},f=null;
try{f=localStorage.getItem(${JSON.stringify(FONT_KEY)})}catch(e){}
document.documentElement.setAttribute('data-font',ids.indexOf(f)>=0?f:${JSON.stringify(DEFAULT_FONT)});
}catch(e){}})();
`;
}
