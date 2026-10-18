# Ronsu

A Mastodon reader PWA (Svelte 5, Vite, TypeScript). A static site with no backend, deployed by hand.

## Public repository

This is a public repository. Never commit, hardcode or mention, in code, comments, tests, fixtures or commit messages:

* Real names, emails, handles or other personal details of any person
* Tokens, client secrets, passwords or any credentials (tests use fake values and `mock.test`)
* Real server URLs, domains or IP addresses (use `ronsu.example.org` and `mastodon.example`)
* File paths with a username

Before committing, scan the staged diff for these.

## Commits

* Work on a new branch for every change, never directly on `main`. Name it `type/short-description` with a type
  such as `fix`, `feature`, `docs` or `chore` (for example `fix/login-error`, `feature/image-viewer`)
* One logical change per commit
* One concise line, sentence case, present tense. No long explanations in the message, no emojis
* Commit messages and PR descriptions are in English
* Never add Co-Authored-By lines or any AI attribution (watermarks, "Generated with" lines) to commits or pull requests
* Update `CHANGELOG.md` in the same change (see Changelog)
* Commit only when asked. Stage only the relevant files, never `git add -A`
* Run `git status` after committing to verify nothing is left over
* Never push, merge or deploy without being asked

## Working method

* Follow DRY, KISS and YAGNI. Do not build features, abstractions or configuration "just in case"
* Reproduce a reported bug with a test first (the Mastodon API is mocked in `e2e/mock.ts`), then fix it
* Never patch just the line you see: trace the whole chain (callers, stores, tests, translations) first
* Verify before claiming success: `npm run check`, `npm test`, `npm run build`, then `npm run test:e2e`.
  The browser tests run against the build in `public/`, so build first. For UI changes, look at a rendered screenshot
* Do not guess Mastodon behaviour: check the official docs or source
* A limit needs a reason (an API limit or a decision), a named constant and a comment
* Never clean up or delete data or files nobody asked about
* Ask before installing dependencies, starting services or doing anything outside the repository

## Code style

* Code, comments, tests and docs are in English. Only UI strings are translated (`src/lib/i18n/en.ts` and `fi.ts`,
  always the same keys). Wording follows Mastodon's own translations (Finnish: julkaisu, tehosta, suosikki, palvelin)
* No emojis in code, commits or UI. Icons are Lucide
* Prefer CSS classes and theme variables over inline styles. The layout is one column on every screen

## Changelog

* `CHANGELOG.md` lists every released version, newest first, and the changes waiting for the next release. Update it with each change
* Format: a `### x.y.z: yyyy-mm-dd` heading per version, no main "Changelog" heading, no sub headings
* Bullets with `*`, one line per change, present tense, concise, no repetition
* No formatting except inline code and, when absolutely necessary, nothing more
* Changes that are not released yet go under a `### Unreleased` heading at the top (no date). Every PR adds its own
  lines there and never touches the version
* A contributor's PR adds only its changelog line, never a version. The maintainer picks the version at release time
* A release is its own small PR (or, for a release of one single change, part of that PR): it renames the heading to
  `### x.y.z: yyyy-mm-dd`, bumps `package.json` and `package-lock.json` (the version shown in the app comes from
  there) and checks today's date. After it is merged, tag `vx.y.z` and create the GitHub release
* Sensible semver, chosen at release time from what has piled up: patch by default (a fix, a tweak or a small
  feature, also several of them together). Minor when something changes profoundly or the release collects a
  clearly larger set of changes, major only for something like a full redesign of the UI
* A version is created per release, not per day: after a release the next change starts a new `Unreleased` section,
  even on the same day

## Security

* Server data reaches the page only through the sanitizers in `src/lib/html.ts`, and every server address in a link
  or media element goes through `safeHttpUrl()` in `src/lib/url.ts`
* Keep the OAuth scopes minimal (`SCOPES` in `src/lib/api/oauth.ts`). Changing them can require a re-login, which
  the app asks for itself; mention it in the README
* Keep PKCE and the `state` check. The `<meta>` CSP in `index.html` and the header example in the README must stay equal

## Documentation

* Keep `README.md` up to date in the same change as the feature
* Sentence case headings, real heading levels (never bold text as a heading), an empty line after each heading
* No separator lines or decorated headings such as `=====` or `=== Something ===`
