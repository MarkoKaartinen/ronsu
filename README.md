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

Tests before publishing: `npm run check`, `npm test`, `npm run test:e2e` (the last one needs the build and Chrome).
