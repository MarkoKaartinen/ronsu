# Ronsu

An opinionated Mastodon client built for reading. Ronsu is a PWA that runs entirely in the browser,
with no server of its own: you log in with OAuth2 (PKCE) straight to your own Mastodon server, and your
reading position is stored in the server's markers API (and locally, so it works immediately and offline).
Read the timeline from the oldest unread post forward, close the app, and continue from the same post on
any device.

Ronsu is opinionated: it does fewer things than other clients, and it does them its own way. The timeline is
something you read through and finish, not something you scroll forever, so it shows how far behind you are
instead of an unread count, and it keeps your place for you. It is also a work in progress: the first priority is
a good reading experience, and features that do not serve it may never come.

"Ronsu" is a Finnish children's word for "elephant"; the logo is an elephant with a bookmark in the corner of the icon.

> **Built with AI.** This app was written with the help of AI (Claude Code by Anthropic), under my direction
> and review. Treat it like any other code: read it, test it, and check it before trusting it with your
> account.

Source code and issues: <https://github.com/MarkoKaartinen/ronsu>

## Features

- Home timeline in reading order (oldest first, or newest first) with a saved reading position that follows you
  from device to device
- Several accounts, threads, profiles, replying and posting (content warnings, visibility, language)
- Favorite, boost and bookmark; follow and unfollow
- An in-app image viewer: swipe or use the arrow keys between a post's pictures, tap to zoom, Esc or back to close
- Light and dark themes that follow the system or your own choice: Nord (dark/light) and Dracula (dark) / Alucard (light)
- English and Finnish, switchable in the settings
- A choice of fonts: Figtree, Inter, Open Sans, JetBrains Mono or the system font (all SIL OFL, self-hosted)
- Installable as a PWA, works offline for the app shell

## Development

```sh
npm install
npm run dev          # development server
npm run check        # type check (svelte-check)
npm test             # unit tests (Vitest)
npm run build        # production build into public/
npm run test:e2e     # Playwright (serves the built public/ folder, mocked API, needs Chrome)
```

`npm run test:e2e` serves the `public/` folder, so run `npm run build` first.

**Stack:** Svelte 5, Vite, vite-plugin-pwa (service worker), TypeScript. No backend.

## Structure

- `src/` the app (`components/`, `lib/` logic and API client, `lib/stores/` state)
- `src/lib/themes.ts` and `src/lib/fonts.ts` the themes and fonts as data (Nord, Dracula/Alucard; Figtree, Inter, ...); their CSS and `theme-init.js` are generated at build time
- `src/lib/i18n/` the translations (`en.ts`, `fi.ts`) and the helpers for formatting
- `static/` files copied as is into `public/` (icons)
- `branding/` the logo sources (SVG)
- `e2e/` Playwright tests

## Languages

The UI is available in English and Finnish. The language follows the browser until you choose one in the
settings. The wording follows Mastodon's own translations where they have a matching string (for example
"boost" / "tehosta", "favorite" / "suosikki", "server" / "palvelin"), so the terms match what you see on your
server. `src/lib/i18n/en.ts` notes the Mastodon translation key next to each such string.

To add a language: copy `en.ts` to a new file with the same keys, register it in `src/lib/i18n/index.ts`
(`LOCALES`, `LOCALE_NAMES`, `dictionaries`), and run `npm test`. The tests check that every language defines
exactly the same keys and placeholders.

## Deployment

Ronsu is a static site: no backend and no secrets. To publish it, run these commands (Node 22):

```sh
npm ci
npm run build
```

The finished site is created in the `public/` folder (it is in `.gitignore`). Serve it from the root of a domain.

Requirements:

- HTTPS (the service worker, installing to the home screen and logging in only work with it).
- The root of a domain or subdomain, e.g. `https://ronsu.example.org/`. A subfolder will not work, because the
  login redirect URI is `https://<domain>/`.
- The server needs no rewrite rules (routing uses `#` URLs). Do not cache `index.html`, `sw.js`,
  `theme-init.js`, `boot-guard.js` and `manifest.webmanifest`, so updates apply immediately.

### Security headers (required for a public deployment)

`index.html` has a Content-Security-Policy in a `<meta>` element. That works for scripts, styles and connections,
but a browser **ignores `frame-ancestors` in a meta element**, so the only way to stop other sites from putting
Ronsu in a frame (and tricking a logged-in reader into clicking something) is an HTTP response header from your
web server. Send these headers with every response, in addition to the meta element:

```
Content-Security-Policy: default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

(`X-Frame-Options` is for old browsers.) The policy is the one in `index.html` plus `frame-ancestors 'none'`; a
unit test (`src/lib/headers.test.ts`) fails if the two drift apart, so update both together.

nginx (in the `server` block; `always` also covers error pages):

```nginx
add_header Content-Security-Policy "default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

Apache (`mod_headers`, in the virtual host or `.htaccess`):

```apache
Header always set Content-Security-Policy "default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
Header always set X-Frame-Options "DENY"
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
```

Caddy:

```caddy
header {
    Content-Security-Policy "default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    X-Frame-Options "DENY"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
}
```

Netlify and Cloudflare Pages: put the same four headers under `/*` in a `_headers` file in the published folder
(for example `static/_headers`, which the build copies to `public/`).

Check the result on the real site, not in a local copy (reload after changing the server, headers can be cached by
a CDN):

```sh
curl -sI https://ronsu.example.org/ | grep -iE 'content-security-policy|x-frame-options|x-content-type-options|referrer-policy'
```

The output must include `frame-ancestors 'none'`. Then try it: a page of your own with
`<iframe src="https://ronsu.example.org/">` must show an empty frame (the console says the frame was refused).

The login return address contains a one-time `code`. It is useless without the browser's secret verifier, but keep
it out of long-lived logs where you can (for example do not log query strings of `/`).

Tests before publishing: `npm run check`, `npm test`, `npm run test:e2e` (the last one needs the build and Chrome).
