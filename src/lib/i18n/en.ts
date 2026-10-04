/**
 * English UI strings (source of truth for the keys; fi.ts must define exactly the same keys).
 *
 * Wording follows Mastodon's own web client wherever it has a matching string. The Mastodon
 * translation key is noted as `// mastodon: <key>` (app/javascript/mastodon/locales/{en,fi}.json),
 * so the terms stay consistent with what people see on their server (e.g. "boost", "favorite", "post").
 * Strings without a note are specific to Ronsu. "Ronsu" itself is never translated.
 *
 * Plural messages use the keys `<name>.one` and `<name>.other`. The numeric `count` parameter selects the
 * variant; the optional `{counter}` placeholder is where the (formatted) number is shown, as in Mastodon.
 */
export const en = {
  'common.loading': 'Loading…', // mastodon: loading_indicator.label
  'common.back': 'Back', // mastodon: column_back_button.label
  'common.cancel': 'Cancel', // mastodon: alt_text_modal.cancel
  'common.retry': 'Try again', // mastodon: bundle_column_error.retry
  'crash.title': 'Oh, no!', // mastodon: bundle_column_error.error.title
  'crash.explanation': 'Due to a bug in our code or a browser compatibility issue, this page could not be displayed correctly.', // mastodon: error.unexpected_crash.explanation
  'crash.addons': 'This page could not be displayed correctly. This error is likely caused by a browser add-on or automatic translation tools.', // mastodon: error.unexpected_crash.explanation_addons
  'crash.reset': "Reset the app's cache and reload",

  'common.close': 'Close', // mastodon: lightbox.close

  'time.now': 'now', // mastodon: relative_time.just_now
  'time.minutes': '{number}m', // mastodon: relative_time.minutes
  'time.hours': '{number}h', // mastodon: relative_time.hours
  'time.days': '{number}d', // mastodon: relative_time.days

  'nav.newPost': 'New post', // mastodon: compose.post.title.new
  'nav.account': 'Account: @{acct}',
  'thread.title': 'Thread', // mastodon: status.replyAll ("Reply to thread")
  'thread.replyTo': 'Replying to {name}…', // mastodon: status.replying_to
  'profile.title': 'Profile',
  'profile.linkVerified': 'Ownership of this link was checked on {date}', // mastodon: account.link_verified_on
  'profile.viewOn': 'View on {domain}', // mastodon: account.menu.open_original_page

  'feed.behind': 'You are {age} behind',
  'feed.upToDate': 'You are up to date',
  'feed.hintNewest': 'Newest posts first',
  'feed.hintSaved': 'Your reading position is saved automatically',
  'feed.order': 'Reading order',
  'feed.oldestFirst': 'Oldest first',
  'feed.newestFirst': 'Newest first',
  'feed.remoteAhead': 'You have read further on another device.',
  'feed.jump': 'Jump',
  'feed.notNow': 'Not now',
  'feed.loadOlder': 'Load older',
  'feed.loadNew': 'Load new',
  'feed.noNew': 'No new posts.',
  'feed.caughtUp': 'You are all caught up.',
  'feed.empty': 'No new posts.',
  'feed.readUpTo': 'Read up to here',
  'feed.leftOffHere': 'You left off here',
  'feed.error.markerFetch': 'Could not fetch your reading position: {message}',
  'feed.error.markerSave': 'Could not save your reading position to Mastodon: {message}',

  'status.boostedBy': '{name} boosted', // mastodon: status.reblogged_by
  'status.showPost': 'Show post', // mastodon: content_warning.show_post
  'status.hidePost': 'Hide post', // mastodon: content_warning.hide_post
  'status.sensitive': 'Sensitive content', // mastodon: status.sensitive_warning
  'status.showMedia': 'Show media', // mastodon: content_warning.media.show_short
  'status.attachment': 'Attachment',
  'status.openOriginal': 'Open original page', // mastodon: account.open_original_page
  'status.replies.one': '{counter} reply', // mastodon: status.replies_count
  'status.replies.other': '{counter} replies',
  'status.boosts.one': '{counter} boost', // mastodon: status.reblogs_count
  'status.boosts.other': '{counter} boosts',
  'status.favorites.one': '{counter} favorite', // mastodon: status.favourites_count
  'status.favorites.other': '{counter} favorites',

  'action.reply': 'Reply', // mastodon: status.reply
  'action.boost': 'Boost', // mastodon: status.reblog
  'action.unboost': 'Unboost', // mastodon: status.cancel_reblog_private
  'action.cannotBoost': 'This post cannot be boosted', // mastodon: status.cannot_reblog
  'action.favorite': 'Favorite', // mastodon: status.favourite
  'action.unfavorite': 'Remove from favorites',
  'action.bookmark': 'Bookmark', // mastodon: status.bookmark
  'action.removeBookmark': 'Remove bookmark', // mastodon: status.remove_bookmark
  'action.failed': 'Something went wrong: {message}',

  'lightbox.previous': 'Previous', // mastodon: lightbox.previous
  'lightbox.next': 'Next', // mastodon: lightbox.next
  'lightbox.zoomIn': 'Zoom to actual size', // mastodon: lightbox.zoom_in
  'lightbox.zoomOut': 'Zoom to fit', // mastodon: lightbox.zoom_out
  'lightbox.counter': '{current} / {total}',

  'compose.titleNew': 'New post', // mastodon: compose.post.title.new
  'compose.titleReply': 'Reply', // mastodon: compose_form.reply
  'compose.publish': 'Post', // mastodon: compose_form.publish
  'compose.publishing': 'Posting…',
  'compose.placeholder': "What's on your mind?", // mastodon: compose_form.placeholder
  'compose.cw': 'Content warning', // mastodon: compose.sensitive.text
  'compose.cwToggle': 'CW',
  'compose.visibility': 'Visibility', // mastodon: compose.visibility.title
  'compose.visibility.public': 'Public', // mastodon: privacy.public.short
  'compose.visibility.unlisted': 'Quiet public', // mastodon: privacy.unlisted.short
  'compose.visibility.private': 'Followers', // mastodon: privacy.private.short
  'compose.visibility.direct': 'Private mention', // mastodon: privacy.direct.short
  'compose.language': 'Language', // mastodon: about.language_label
  'compose.languageDefault': 'Default', // mastodon: about.default_locale
  'compose.discard': 'Discard your draft post?', // mastodon: confirmations.discard_draft.post.title
  'compose.published': 'Post published.', // mastodon: compose.published.body

  'login.tagline': 'A Mastodon reader that remembers where you left off.',
  'login.server': 'Server', // mastodon: about.rules ("Server rules"), "server" is the term used for instances
  'login.submit': 'Log in', // mastodon: server_banner.log_in
  'login.redirecting': 'Redirecting…',
  'login.help':
    'Log in to your Mastodon server. Your reading position is stored on the server and follows you from device to device.',
  'login.error.server': 'Enter your server address, e.g. mastodon.social',
  'login.error.register': 'Registering the app failed ({status})',
  'login.error.cancelled': 'Login was cancelled',
  'login.error.noState': 'The login state is missing, please try again',
  'login.error.state': 'Login verification failed (state)',
  'login.error.token': 'Fetching the access token failed ({status})',

  'settings.title': 'Account and settings',
  'settings.accounts': 'Accounts',
  'settings.active': 'Active',
  'settings.switch': 'Switch',
  'settings.switchTo': 'Switch to {acct}',
  'settings.addAccount': '+ Add account',
  'settings.theme': 'Theme',
  'settings.themeMode': 'Theme mode',
  'settings.system': 'System',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.lightTheme': 'Light theme',
  'settings.darkTheme': 'Dark theme',
  'settings.font': 'Font',
  'settings.language': 'Language', // mastodon: about.language_label
  'settings.logout': 'Log out', // mastodon: confirmations.logout.confirm
  'theme.nord-dark': 'Nord Dark',
  'theme.nord-light': 'Nord Light',
  'theme.dracula-dark': 'Dracula',
  'theme.dracula-light': 'Alucard',

  'profile.follow': 'Follow', // mastodon: account.follow
  'profile.followRequest': 'Request to follow', // mastodon: account.follow_request
  'profile.unfollow': 'Unfollow', // mastodon: account.unfollow
  'profile.cancelRequest': 'Cancel request', // mastodon: account.follow_request_cancel
  'profile.yourProfile': 'Your profile',
  'profile.followsYou': 'Follows you', // mastodon: account.follows_you
  'profile.locked': 'Locked', // mastodon: compose_form.lock_disclaimer.lock
  'profile.bot': 'Automated', // mastodon: account.badges.bot
  'profile.posts': 'Posts', // mastodon: account.posts
  'profile.following': 'Following', // mastodon: account.following
  'profile.followers': 'Followers', // mastodon: account.followers
  'profile.notFound': 'Profile unavailable', // mastodon: empty_column.account_unavailable
  'profile.noPosts': 'No posts here!', // mastodon: empty_column.account_timeline
  'profile.noMore': 'No more posts.',
  'profile.reauth': 'Following needs a new permission. Log in again to follow users.',
  'profile.reauthButton': 'Log in again',
  'profile.followFailed': 'Following failed: {message}',
} as const;
