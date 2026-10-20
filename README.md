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

> **Under active development.** Ronsu changes quickly, and the permissions it asks your Mastodon server for
> (OAuth scopes) may change with it. After an update the app may ask you to log in again to use a new feature;
> your reading position is kept on the server, so nothing is lost. A login made before the change keeps working
> with the permissions it already has.

> **Built with AI.** This app was written with the help of AI (Claude Code by Anthropic), under my direction
> and review. Treat it like any other code: read it, test it, and check it before trusting it with your
> account.

Source code and issues: <https://github.com/MarkoKaartinen/ronsu>

## Features

- Home timeline in reading order (oldest first, or newest first) with a saved reading position that follows you
  from device to device. "Load new" keeps at most 50 posts in the list (the ones furthest from where you are
  reading are dropped, and "Load more" / "Load older" bring them back), so the page does not grow without end.
  A position is never sent to the server when another device has already read further: the app asks first
- The keyword filters you have set on your server are honored: a filtered post is hidden, covered with a warning that names the filter, or has its pictures blurred, as the filter says
- Several accounts, threads, profiles, replying and posting (content warnings, visibility, language, account suggestions after `@`, an emoji picker with the frequently used, the server's custom and the Unicode emoji)
- Favorite, boost and bookmark; follow and unfollow
- An in-app image viewer: swipe or use the arrow keys between a post's pictures, tap to zoom, Esc or back to close
- Light and dark themes that follow the system or your own choice: Nord (dark/light) and Dracula (dark) / Alucard (light)
- English and Finnish, switchable in the settings
- A choice of fonts: Figtree, Inter, Open Sans, JetBrains Mono or the system font (all SIL OFL, self-hosted)
- Push notifications, also when Ronsu is closed: a switch per notification type, a sound switch per type, and
  a choice of whom they come from (see [Push notifications](#push-notifications))
- A red ball on the bell in the bottom bar (and a mark in the page title and on the app icon) when there is
  something you have not seen; it follows the server's notifications marker, so it is the same on every device
- Installable as a PWA, works offline for the app shell

## Push notifications

Push notifications need no server of Ronsu's own. The browser subscribes to the push service with your Mastodon
server's key and gives the address to your server (Mastodon's Web Push API), which then sends the notifications
straight to the browser. Ronsu's service worker shows them.

- **Permission:** push needs the `push` OAuth scope. A login made before it was added is asked to log in again
  (the banner at the top); after that the switch is in the settings.
- **Settings:** which types are sent, and from whom, are stored on the server for this login, so they are separate
  on each device you log in on. The sound and the mark on the app icon are remembered by the device. The server
  decides what is sent; Ronsu decides how a notification arrives.
- **Sound:** the sound of a notification is the system's own. A page can only choose whether a notification makes
  one, so each type has a sound switch and no choice of sound. While Ronsu is open and in use, it shows the news
  itself instead (the notifications update at once and Ronsu makes a short sound if that type's sound is on).
- **Test:** "Send a test notification" shows one through the service worker. It checks the permission, the sound and
  the click, not that your server delivers; for that, have someone favorite one of your posts.
- **Server:** the server must send its VAPID key in the instance information (Mastodon 4.3 or newer). Ronsu asks
  for the standardized encryption, which Mastodon 4.4 or newer supports; the push of an older server may not reach
  Safari.
- **iPhone and iPad:** web push works only for an app added to the Home Screen.
- **Accounts:** a browser subscription is made with one server's key, so push works for the accounts of one server at
  a time; switching push on for an account on another server replaces the subscription of the first.

The bell shows what the server's `notifications` marker says: it moves forward when you look at the notifications
(or have them in view on a wide screen), and Mastodon's own apps read and write the same marker.

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
- `static/` files copied as is into `public/` (icons, `push-sw.js`: the push part of the service worker, plain JavaScript)
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

## Installation

Ronsu is a static site that you build and host yourself (Node 22):

```sh
git clone https://github.com/MarkoKaartinen/ronsu.git
cd ronsu
git checkout $(git describe --tags --abbrev=0 origin/main)   # the latest release
npm ci
npm run build
```

Serve the `public/` folder as described in [Deployment](#deployment).

`main` is the development branch and can contain unreleased features that are not finished.
Install a tagged release unless you want to follow development.

## Updating

Releases are listed on <https://github.com/MarkoKaartinen/ronsu/releases>. Each release has its own update
instructions. Normally:

```sh
git fetch
git checkout $(git describe --tags --abbrev=0 origin/main)   # the latest release
npm ci
npm run build
```

To update to a specific release, use its tag instead, for example `git checkout v0.1.3`.
Then replace the served `public/` folder with the new build. The service worker updates the app on the next
visit, and the app may ask you to log in again if the OAuth scopes changed. Read the release notes first: they
say if a release needs anything more.

### Following the main branch

`main` contains the changes listed under "Unreleased" in `CHANGELOG.md`. They can be unfinished or change before
the release, so use it only for testing:

```sh
git checkout main
git pull
npm ci
npm run build
```

## Deployment

Ronsu is a static site: no backend and no secrets. [Build it](#installation) and serve the `public/` folder
(it is in `.gitignore`) from the root of a domain.

Requirements:

- HTTPS (the service worker, installing to the home screen and logging in only work with it).
- The root of a domain or subdomain, e.g. `https://ronsu.example.org/`. A subfolder will not work, because the
  login redirect URI is `https://<domain>/`.
- The server needs no rewrite rules (routing uses `#` URLs). Do not cache `index.html`, `sw.js`,
  `theme-init.js`, `boot-guard.js` and `manifest.webmanifest`, so updates apply immediately.

### Security headers

A browser ignores `frame-ancestors` in the `<meta>` Content-Security-Policy of `index.html`, so keeping other sites
from putting Ronsu in a frame needs an HTTP header from your web server. Send the policy of `index.html` plus
`frame-ancestors 'none'` with every response. nginx, in the `server` block:

```nginx
add_header Content-Security-Policy "default-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

Other servers need the same four headers set their own way. Check the real site:

```sh
curl -sI https://ronsu.example.org/ | grep -iE 'content-security-policy|x-frame-options'
```

`src/lib/headers.test.ts` fails if the policy above and the one in `index.html` drift apart: update both.

Tests before publishing: `npm run check`, `npm test`, `npm run test:e2e` (the last one needs the build and Chrome).

## License

Ronsu is released under the [MIT License](LICENSE).
