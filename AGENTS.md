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

* One logical change per commit
* One concise line, sentence case, present tense. No long explanations in the message
* Commit messages and PR descriptions are in English
* Never add Co-Authored-By lines or any AI attribution to commits or pull requests
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
* No emojis in code or UI. Icons are Lucide
* Prefer CSS classes and theme variables over inline styles. The layout is one column on every screen

## Security

* Server data reaches the page only through the sanitizers in `src/lib/html.ts`, and every server address in a link
  or media element goes through `safeHttpUrl()` in `src/lib/url.ts`
* Keep the OAuth scopes minimal (`SCOPES` in `src/lib/api/oauth.ts`). Changing them can require a re-login, which
  the app asks for itself; mention it in the README
* Keep PKCE and the `state` check. The `<meta>` CSP in `index.html` and the header example in the README must stay equal

## Documentation

* Keep `README.md` up to date in the same change as the feature
* Sentence case headings, real heading levels (never bold text as a heading), an empty line after each heading
