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
}

export interface Mention {
  id: string;
  username: string;
  acct: string;
  url: string;
}

export type Visibility = 'public' | 'unlisted' | 'private' | 'direct';

export interface Status {
  id: string;
  uri: string;
  url: string | null;
  created_at: string;
  account: Account;
  content: string;
  spoiler_text: string;
  sensitive: boolean;
  visibility: Visibility;
  in_reply_to_id: string | null;
  reblog: Status | null;
  /** A quote post (Mastodon 4.5+); the quoted post is only there when its author has accepted the quote */
  quote?: { state: string; quoted_status: Status | null } | null;
  media_attachments: MediaAttachment[];
  emojis: CustomEmoji[];
  mentions?: Mention[];
  replies_count: number;
  reblogs_count: number;
  favourites_count: number;
  favourited?: boolean;
  reblogged?: boolean;
  bookmarked?: boolean;
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
}
