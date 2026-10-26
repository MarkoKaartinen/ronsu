export interface Account {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
  url: string;
  emojis?: CustomEmoji[];
}

/** A profile field ("Website", "Pronouns", ...); `value` is HTML, `verified_at` is set for verified links */
export interface ProfileField {
  name: string;
  value: string;
  verified_at: string | null;
}

/** Full account (GET /accounts/:id); inside posts the account has only some of the fields */
export interface AccountFull extends Account {
  header: string;
  note: string;
  fields?: ProfileField[];
  followers_count: number;
  following_count: number;
  statuses_count: number;
  locked: boolean;
  bot: boolean;
}

export interface Relationship {
  id: string;
  following: boolean;
  requested: boolean;
  followed_by: boolean;
  blocking: boolean;
  muting: boolean;
  /** Whether a mute also hides the notifications of the account */
  muting_notifications?: boolean;
  domain_blocking?: boolean;
}

export interface MediaMeta {
  width?: number;
  height?: number;
  aspect?: number;
}

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
  preview_url: string;
  description: string | null;
  meta?: { small?: MediaMeta; original?: MediaMeta } | null;
}

export interface CustomEmoji {
  shortcode: string;
  url: string;
  static_url: string;
  /** Only in the server's emoji list: false for an emoji that is not meant to be offered */
  visible_in_picker?: boolean;
  category?: string | null;
}

export interface Mention {
  id: string;
  username: string;
  acct: string;
  url: string;
}

export type Visibility = 'public' | 'unlisted' | 'private' | 'direct';

export interface Poll {
  id: string;
  expires_at: string | null;
  expired: boolean;
  multiple: boolean;
  votes_count: number;
  voters_count: number | null;
  /** votes_count is null while the totals are hidden (until the poll has ended) */
  options: { title: string; votes_count: number | null }[];
  emojis: CustomEmoji[];
  voted?: boolean;
  /** Indexes of the options this account voted for */
  own_votes?: number[];
}

/** The preview of a link in a post (the `html` of a video or rich card is never used: it is markup from another site) */
export interface PreviewCard {
  url: string;
  title: string;
  description: string;
  type: 'link' | 'photo' | 'video' | 'rich' | string;
  provider_name?: string;
  image: string | null;
  /** Mastodon 4.4+: the alt text of the image */
  image_description?: string;
}

/** Where a server-side filter applies (`profile` is what the docs call a profile view; the API value is `account`) */
export type FilterContext = 'home' | 'notifications' | 'public' | 'thread' | 'account';

/** A server-side keyword filter that matched a status (Mastodon 4.0+; `blur` is 4.4+, other values count as `warn`) */
export interface FilterResult {
  filter: {
    id: string;
    title: string;
    context: FilterContext[];
    expires_at: string | null;
    filter_action: 'warn' | 'hide' | 'blur' | string;
  };
}

export interface Status {
  id: string;
  uri: string;
  url: string | null;
  created_at: string;
  /** When the post was last edited; null (or not there) for a post that never was */
  edited_at?: string | null;
  account: Account;
  content: string;
  spoiler_text: string;
  sensitive: boolean;
  visibility: Visibility;
  /** ISO 639-1 code of the post's language; null when the server does not know it */
  language?: string | null;
  in_reply_to_id: string | null;
  in_reply_to_account_id?: string | null;
  /** The conversation is muted (only there for a signed-in account) */
  muted?: boolean;
  reblog: Status | null;
  /** A quote post (Mastodon 4.5+); the quoted post is only there when its author has accepted the quote */
  quote?: { state: string; quoted_status: Status | null } | null;
  media_attachments: MediaAttachment[];
  emojis: CustomEmoji[];
  mentions?: Mention[];
  poll?: Poll | null;
  replies_count: number;
  reblogs_count: number;
  /** Mastodon 4.5+; missing on servers that do not count quotes */
  quotes_count?: number;
  /** Mastodon 4.5+: who may quote the post; `current_user` is the answer for the signed-in account */
  quote_approval?: { automatic?: string[]; manual?: string[]; current_user?: 'automatic' | 'manual' | 'denied' | 'unknown' } | null;
  favourites_count: number;
  favourited?: boolean;
  reblogged?: boolean;
  bookmarked?: boolean;
  /** The user's filters that matched the post; only there for a signed-in account */
  filtered?: FilterResult[];
  /** The first link of the post, with its title, description and picture; null when the server has none (yet) */
  card?: PreviewCard | null;
}

/** One version of an edited post (GET /statuses/:id/history lists them, the oldest first) */
export interface StatusVersion {
  content: string;
  spoiler_text: string;
  sensitive: boolean;
  /** When this version was written */
  created_at: string;
  account: Account;
  media_attachments: MediaAttachment[];
  emojis: CustomEmoji[];
  poll?: { options: { title: string }[] } | null;
}

/** A private mention thread (GET /conversations): who is in it and its newest post */
export interface Conversation {
  id: string;
  unread: boolean;
  accounts: Account[];
  last_status: Status | null;
}

export interface Context {
  ancestors: Status[];
  descendants: Status[];
}

export interface Marker {
  last_read_id: string;
  version: number;
  updated_at: string;
}

/** Tallennettu tili (IndexedDB). Avain: `${instance}|${accountId}` */
export interface StoredAccount {
  key: string;
  instance: string; // esim. mastodon.social (ilman https://)
  clientId: string;
  clientSecret: string;
  token: string;
  accountId: string;
  acct: string;
  displayName: string;
  avatar: string;
  /** The account's own default for new posts (Mastodon's "Posting privacy"); missing on logins made before it was stored */
  defaultPrivacy?: Visibility;
  /** The permissions (OAuth scopes) the token was given, as the server reported them; missing on logins made before they were stored */
  scopes?: string;
}

/** The own account as `verify_credentials` returns it: `source` holds the account's posting defaults */
export interface AccountCredentials extends Account {
  source?: { privacy?: string };
}

/** A notification; `status` is the post it is about (not for follows) */
export interface Notification {
  id: string;
  type: string;
  created_at: string;
  account: Account;
  status?: Status | null;
}
