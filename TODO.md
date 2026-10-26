# TODO

What Ronsu does not do yet, found by comparing the app with the
[Mastodon API](https://docs.joinmastodon.org/methods/) and with other clients (the official web UI, Elk, Phanpy,
Ivory, Tusky, Mona). Reading comes first, but Ronsu already posts, replies, boosts, follows and pushes notifications, so this list also
covers writing and account management. Not every item has to be built: each one still has to fit Ronsu's own way
of doing things. Items are grouped by area, roughly in order of importance.

Scopes noted per item are the extra OAuth scopes the item needs. Adding one means a re-login (see "Security" in
`AGENTS.md`) and a line in the README.

## Reading: gaps in the core experience

- [x] **Polls** are voted on (`POST /api/v1/polls/:id/votes`, `write:statuses`, already granted), with one option or
  several, and an open poll is refreshed with a button (`GET /api/v1/polls/:id`) to see the votes of others
- [x] **Server-side filters** (`filtered`, filter actions `warn`, `hide` and `blur`) are honored in the home timeline,
  notifications, threads and profiles. Needs no scope; the filter list itself (`read:filters`) is not shown
- [x] **Link previews**: the `card` of a status (title, description, image, provider). Left: `card.authors` (fediverse
  creator attribution) if wanted
- [x] **Emoji picker** in the compose box: frequently used, the server's custom emoji (`GET /api/v1/custom_emojis`) and
  Unicode emoji from `emojibase-data`. Left: skin tones, autocomplete while typing `:name:`
- [x] **Edited posts** are marked with the time of the edit (`edited_at`), and the version history opens from the mark
  (`GET /api/v1/statuses/:id/history`)
- [ ] **No translation.** `POST /api/v1/statuses/:id/translate` (`read:statuses`) when the server supports it
  (`translation.enabled` in `/api/v2/instance`); the `language` of a post tells when to offer it
- [ ] **Boosts grouped** in the timeline (Phanpy): consecutive boosts shown as one row
- [ ] **Hide a boost** you have already seen, and collapse repeated boosts of the same post

## Reading: other timelines and ways to find things

Only the home timeline and notifications can be read. Everything else needs a new route in `router.svelte.ts`, and
the reading position (markers) only exists for `home` and `notifications`, so the other timelines would not be
"read through" in the same way unless they are kept simple.

- [ ] **Lists** (`GET /api/v1/lists`, `/api/v1/timelines/list/:id`, `read:lists`). A smaller timeline that can be read through
- [ ] **Hashtags**: open a hashtag from a post (`GET /api/v1/timelines/tag/:tag`), follow and unfollow a tag
  (`POST /api/v1/tags/:id/follow`, `write:follows`; followed tags appear in the home timeline already), and make
  hashtags in post content link to the hashtag view instead of the remote server
- [ ] **Local and federated timelines** (`/api/v1/timelines/public`, `local=true`). Optional: the home timeline stays the main view
- [ ] **Search** (`GET /api/v2/search`, `read:search`): accounts, hashtags, posts. Includes resolving a
  pasted `@user@server` or post URL (`resolve=true`)
- [x] **Bookmarks** and **favorites** views (`GET /api/v1/bookmarks`, `/api/v1/favourites`, `read:bookmarks`,
  `read:favourites`). Bookmarks can be set but never opened again, which makes them write-only today
- [x] **Direct messages / conversations** (`GET /api/v1/conversations`, `read:statuses`; `write:conversations`
  to mark read). Shown as Mastodon's "Private mentions": the newest post of each conversation, read when the view is opened. Left: delete a conversation, mark one as unread
- [ ] **Who boosted or favorited a post**: `GET /api/v1/statuses/:id/reblogged_by` and `/favourited_by`
- [ ] **Trends and suggestions**: `GET /api/v1/trends/tags`, `/trends/statuses`, `/api/v2/suggestions`
  (`read`). Lower priority
- [ ] **Announcements** of the server (`GET /api/v1/announcements`, `read:accounts`)
- [ ] **Collections** (Mastodon API `collections` group): curated groups of accounts. New; check the docs and the
  server version before building
- [ ] **Link timeline** (`GET /api/v1/timelines/link?url=`): posts that share a given link
- [ ] **Manage lists**: create, rename, delete, add and remove members (`/api/v1/lists`, `write:lists`), and
  add an account to a list from its profile
- [ ] **Manage followed hashtags** (`GET /api/v1/followed_tags`, `read:follows`)
- [ ] **Suggestions: dismiss** (`DELETE /api/v2/suggestions/:id`) if suggestions are added

## Profiles and people

- [ ] **Followers and following lists** of a profile (counts are shown, the lists are not):
  `GET /api/v1/accounts/:id/followers` and `/following`
- [ ] **Profile tabs**: posts only today. Add "Posts and replies" and "Media"
  (`exclude_replies`, `only_media`, `pinned` parameters of `/accounts/:id/statuses`), and show **pinned posts**
  (`pinned=true`)
- [ ] **Edit own profile** (`PATCH /api/v1/accounts/update_credentials`, `write:accounts`): name, bio, fields,
  avatar, header, locked, bot. Also `GET /api/v1/preferences` (`read:accounts`) for the default language and
  sensitive-media setting, which are only partly used now
- [ ] **Account notes** and **private note** on a profile (`POST /api/v1/accounts/:id/note`, `write:accounts`)
- [ ] **Featured hashtags** on profiles (`GET /api/v1/accounts/:id/featured_tags`) and managing own
  (`/api/v1/featured_tags`, `read:accounts`, `write:accounts`)
- [ ] **Endorsed accounts** shown on a profile (`GET /api/v1/accounts/:id/endorsements`) and endorsing
  (`POST /api/v1/accounts/:id/pin`, `write:accounts`)
- [ ] **Familiar followers** on a profile ("followed by people you follow",
  `GET /api/v1/accounts/familiar_followers`, `read:follows`)

## Moderating what you see

Muting and blocking are done from the menus (`write:mutes` and `write:blocks`); what is left is below. For a reader this
matters more than most features, because it decides what is in the timeline.

- [x] **Mute and unmute an account** (`write:mutes`), from the menu on a profile and on a post, with a duration and the "hide notifications" choice
- [x] **Block and unblock an account** (`write:blocks`), from the menu on a profile and on a post
- [x] **Mute a conversation** (`POST /api/v1/statuses/:id/mute`, `write:mutes`): useful when a thread keeps
  producing notifications
- [x] **Block a domain** (`POST /api/v1/domain_blocks`, `write:blocks`)
- [ ] **Hide boosts from an account** (`POST /api/v1/accounts/:id/follow` with `reblogs=false`) and
  **notify on new posts** (`notify=true`). Both belong in the follow button's menu
- [ ] **Keyword filters** management (`/api/v2/filters`, `read:filters`, `write:filters`). Only if the server
  filters are honored (see above); the settings of the web UI can stay the place to edit them
- [ ] **Filter a single post** ("Filter this post" in the web UI): a filter with a status rule (`POST /api/v2/filters`,
  `POST /api/v2/filters/:id/statuses`, `write:filters`). Low priority; goes with the keyword filters above
- [ ] **Report a post or account** (`POST /api/v1/reports`, `write:reports`)
- [ ] **Follow requests**: approve or reject (`/api/v1/follow_requests`, `read:follows`, `write:follows`).
  Notifications show the request, but it can only be answered elsewhere
- [ ] **Muted and blocked lists** (`GET /api/v1/mutes`, `/blocks`, `/domain_blocks`, `read:mutes`, `read:blocks`)
  so they can be undone from Ronsu

## Writing

- [x] **Delete a post** (`DELETE /api/v1/statuses/:id`, `write:statuses`) from the post menu, after a confirmation.
  Left: "Delete and redraft" (the response carries the source text)
- [x] **Edit a post** (`PUT /api/v1/statuses/:id`, `GET /api/v1/statuses/:id/source`) in the composer: text, content
  warning, pictures with their alt texts and the poll. The visibility cannot be changed, as on Mastodon
- [x] **Create a poll** in the composer (`poll[options][]`, `expires_in`, `multiple`), within the limits of `configuration.polls`
  of the instance information. Left: `hide_totals` (Mastodon's own form does not offer it either)
- [ ] **Scheduled posts** (`scheduled_at`, `GET /api/v1/scheduled_statuses`, `read:statuses`)
- [ ] **Drafts**: kept locally; Mastodon has no draft endpoint
- [ ] **Quote policy per post** (`quote_approval_policy`, Mastodon 4.5): who may quote the new post
- [ ] **Pin and unpin own posts** (`POST /api/v1/statuses/:id/pin`, `write:accounts`)
- [x] **Mentions autocomplete** while typing `@` (`GET /api/v1/accounts/search`, `read:accounts`)
- [ ] **Hashtag autocomplete** while typing `#` (`GET /api/v2/search?type=hashtags`)
- [ ] **Sensitive media toggle and media focal point** for uploads (`focus` in `PUT /api/v1/media/:id`)
- [ ] **Boost visibility**: `POST /api/v1/statuses/:id/reblog` takes `visibility`, so a boost can be private
- [ ] **Revoke a quote** of your post (`POST /api/v1/statuses/:id/quotes/:quote_id/revoke`, Mastodon 4.5,
  `write:statuses`) and see the quotes of a post
- [ ] **Image tools in the composer**: crop, rotate, remove metadata, a GIF picker (no Mastodon endpoint, a
  third-party API would break the "no backend, nobody else" rule)

## Notifications

- [ ] **Grouped notifications API** (`GET /api/v2/notifications`, Mastodon 4.3+). Ronsu groups on the client from
  the flat list, so a favorited post with hundreds of favorites loads many pages. The server grouping is exact and
  paginates by group. Keep the flat list as a fallback for older servers (`/api/v2/instance` shows the
  `api_versions`)
- [ ] **Notification policy and requests** (`/api/v2/notifications/policy`, `/api/v1/notifications/requests`,
  Mastodon 4.3+): filtered notifications from people you do not follow, which are hidden today with no way to look
- [ ] **Dismiss and clear notifications** (`POST /api/v1/notifications/:id/dismiss`, `/clear`, `write:notifications`)
- [ ] **More notification types** to show and push: `admin.sign_up`, `admin.report`, `severed_relationships`,
  `moderation_warning` (these use the `push` scope for web push; showing them needs `read:notifications`)

## Live updates

- [ ] **Streaming** (`/api/v1/streaming`, `read:statuses`, `read:notifications`). Nothing updates until the user
  asks. For a reader that may be right, but the notification bell could use the `user:notification` stream, and edits and deletions (`status.update`, `delete`) would keep the list honest. A browser cannot send
  an `Authorization` header on a WebSocket or `EventSource`; use the `Sec-WebSocket-Protocol` token or `fetch`
  streaming, and check the CSP `connect-src` (it already allows `https:`; `wss:` would need adding, and the README
  header example must change with it)
- [ ] **Background refresh**: periodic check of the home timeline from the service worker, to show how far behind
  the user is on the app icon (Periodic Background Sync is Chromium only)

## Accessibility and interface

- [ ] **Keyboard shortcuts** for reading (next and previous post, favorite, boost, reply, open thread) like
  Phanpy and the official web UI have
- [ ] **Reduced motion**: check animations against `prefers-reduced-motion`
- [ ] **Screen reader audit** of the post card, the lightbox and the composer, with real VoiceOver and TalkBack runs
- [ ] **Per-account display options**: show or hide boosts and replies in the home timeline (a client-side filter
  on `reblog` and `in_reply_to_id`), thread collapse, avatar size, font size (only the font family can be chosen)
- [ ] **Text size setting** independent of the browser zoom
- [ ] **Share target** in the PWA manifest (`share_target`) so a link or text from another app opens the composer
- [ ] **Protocol handler** for `web+mastodon://` links, and opening `https://<server>/@user/<id>` links in Ronsu
- [ ] **Text to speech** and **share a post** with the Web Share API. Copy link and open the original page are in the
  post menu (and "View on {domain}" on profiles)

## Accounts and data

- [ ] **Export and import of settings** (theme, font, language, push choices) between devices; these are stored per
  device on purpose, so this is only worth it if it is asked for
- [ ] **Account migration notice**: show `moved` on a profile and a hint in the timeline when someone you follow
  has moved
- [ ] **Read the user's preferences** (`GET /api/v1/preferences`, `read:accounts`): `reading:expand:media`
  (show or hide sensitive media by default), `reading:expand:spoilers` (open content warnings by default),
  `posting:default:sensitive`, `posting:default:language`. Other clients follow them; Ronsu uses only the default
  visibility
- [ ] **Instance information** (`GET /api/v2/instance`, `/api/v1/instance/rules`, `/api/v1/instance/translation_languages`):
  rules, character and media limits already used; show rules on the login screen and the server's version

## Technical

- [ ] **Mastodon version feature detection.** Several items above (quotes, grouped notifications, push
  standardization) depend on the server version. One place that reads `/api/v2/instance` (`api_versions`,
  `configuration`) and exposes capabilities would replace the scattered checks. Kept per account, because accounts
  can be on different servers: store the capabilities and the time of the fetch with the account, refresh them at
  login and at start when they are over a day old, and keep the old ones if a refresh fails
- [ ] **Compatible servers**: test against Pleroma/Akkoma, GoToSocial, Pixelfed and Firefish forks that implement the
  Mastodon client API. Markers, quotes and push differ; decide what is supported and write it in the README
- [ ] **Rate limits**: handle `429` and the `X-RateLimit-*` headers (300 requests per 5 minutes per account by
  default) with a visible message and a back-off
- [ ] **Error reporting for users**: the crash screen exists; add a way to copy the error and the app version
  without personal data
- [ ] **E2E coverage** for the items above as they land; the mock server in `e2e/mock.ts` needs the endpoints
- [ ] **Bundle size and performance** audit (Lighthouse, Core Web Vitals) before the first public release
- [x] **Release process**: the version number is in the UI, `CHANGELOG.md` has the changes and a release is a tag with
  a GitHub release (see `AGENTS.md`). Left: a deployment script (deploys are by hand)

## Not planned

Left out on purpose, so they are not proposed again by accident.

- Admin and moderation APIs (`/api/v1/admin/*`)
- Profile directory (`/api/v1/directory`), annual reports (Wrapstodon)
- Emoji reactions (not part of Mastodon)
