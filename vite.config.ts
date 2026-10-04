import { existsSync, renameSync, rmSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';
import { FONTS, fontCss, fontInitScript } from './src/lib/fonts';
import { THEMES, themeCss, themeInitScript } from './src/lib/themes';

// Themes and fonts are data: their CSS variables go into a <style> block and the choices are applied before the first paint
// by one external script (the CSP does not allow inline scripts)
function themes(): Plugin {
  const INIT = 'theme-init.js';
  const css = `${themeCss(THEMES)}\n${fontCss(FONTS)}`;
  const script = `${themeInitScript(THEMES)}${fontInitScript(FONTS)}`;
  return {
    name: 'ronsu-themes',
    transformIndexHtml: () => [
      { tag: 'style', children: css, injectTo: 'head-prepend' },
      { tag: 'script', attrs: { src: `/${INIT}` }, injectTo: 'head' },
    ],
    configureServer(server) {
      server.middlewares.use(`/${INIT}`, (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(script);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: INIT, source: script });
    },
  };
}

/**
 * Publishes the finished build to public/ in one step. A build is written to .build/ and only when it is
 * complete (service worker included) does it replace public/, with two renames. Otherwise Vite would empty
 * public/ at the start of every build, and a page loaded while the build is running (e.g. by a Herd site
 * pointing at public/) would miss its CSS or scripts for a few seconds.
 */
function publishAtomically(): Plugin {
  return {
    name: 'ronsu-publish',
    apply: 'build',
    closeBundle: {
      order: 'post',
      handler() {
        if (!existsSync('.build')) return;
        rmSync('public.old', { recursive: true, force: true });
        if (existsSync('public')) renameSync('public', 'public.old');
        renameSync('.build', 'public');
        rmSync('public.old', { recursive: true, force: true });
      },
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    svelte(),
    themes(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Ronsu',
        short_name: 'Ronsu',
        description: 'Ronsu, a Mastodon reader that remembers where you left off',
        id: '/',
        lang: 'en',
        categories: ['social', 'news'],
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#2e3440',
        background_color: '#2e3440',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Hashed js/css/images are precached. HTML is not: the page is fetched from the network first so a
        // new version applies immediately (the cache is only an offline fallback). API calls are never cached.
        // Of the fonts only the default one (Figtree) is precached; the others are cached when first used (below)
        globPatterns: ['**/*.{js,css,png,webmanifest}', 'assets/figtree-*.woff2'],
        globIgnores: ['registerSW.js'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 3 },
          },
          {
            // A font the reader chose: downloaded once, then available offline
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
    publishAtomically(),
  ],
  // Static files (icons) live in static/; public/ is only the build output (served by Herd or the web server)
  publicDir: 'static',
  build: {
    outDir: '.build', // moved to public/ when complete (see publishAtomically)
    emptyOutDir: true,
  },
});
