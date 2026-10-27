import type { MastodonClient } from './client';
import type { Status, Tag } from './types';

/** Mastodon's own default page size for a timeline (the maximum is 40) */
export const TAG_PAGE = 20;

const path = (name: string) => encodeURIComponent(name);

/** The hashtag itself; `following` is there because the request is signed in */
export const getTag = (client: MastodonClient, name: string) => client.get<Tag>(`/api/v1/tags/${path(name)}`);

/** A page of the posts with the hashtag (`read:statuses`), newest first. Timelines page by post id, not by a cursor of their own. */
export const getTagTimeline = (client: MastodonClient, name: string, maxId?: string) =>
  client.getPage<Status>(`/api/v1/timelines/tag/${path(name)}`, { limit: TAG_PAGE, max_id: maxId });

/** Follows or unfollows the hashtag (`write:follows`); its posts then come to the home timeline. The response is the hashtag. */
export const followTag = (client: MastodonClient, name: string, on: boolean) =>
  client.post<Tag>(`/api/v1/tags/${path(name)}/${on ? 'follow' : 'unfollow'}`);
