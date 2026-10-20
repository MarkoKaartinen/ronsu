### Unreleased

* Fix the missing space under the text of a quoted post
* Fix the feed showing "token revoked" after logging in again until the page was reloaded
* On a wide screen the navigation moves to a sidebar with the account at the bottom, beside the feed and the notifications
* On a phone the top and bottom bars stay in place, are slimmer, and the new post button in the bottom bar is a plus
* Show a preview of the link in a post: provider, title, description and picture
* Honor the server's keyword filters: filtered posts are hidden, covered with a warning or have their media blurred
* Add the MIT license
* Fix an occasionally failing login browser test

### 0.1.3: 2026-10-20

* Add installation and update instructions to the README
* Add an emoji picker to the post form: frequently used, the server's custom emoji, then Unicode emoji by category with search
* Update dependencies (`dompurify`, `@lucide/svelte`, `vitest`, `@playwright/test`)

### 0.1.2: 2026-10-18

* Typing `@` in the post form suggests accounts to mention

### 0.1.1: 2026-10-18

* Favorite and boost on the post a reply answers (shown above it) update at once

### 0.1.0: 2026-10-18

* First release
* Home timeline in reading order with a saved reading position that follows you between devices
* Several accounts, threads, profiles, posting and replying with content warnings, visibility and language
* Favorite, boost, quote and bookmark, follow and unfollow
* Image viewer with swipe, zoom and keyboard support, and blurred sensitive media
* Push notifications with a switch per type and a mark on the bell and the app icon
* Nord and Dracula themes in light and dark, English and Finnish, and a choice of fonts
* Installable as a PWA that works offline for the app shell
