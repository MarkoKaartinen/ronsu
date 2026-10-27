import type { Page } from '@playwright/test';

const HOST = 'https://mock.test';
/** What the app asks a login for (src/lib/api/oauth.ts); a seeded account has been given all of it, or the app would ask to log in again */
export const SCOPES =
  'read:accounts read:statuses read:notifications read:follows read:bookmarks read:favourites write:favourites write:statuses write:media write:bookmarks write:follows write:mutes write:blocks write:conversations push';
export const COUNT = 200;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const BASE_ID = 109000000000000000n;

/** The server's VAPID key: the 65 bytes of a P-256 public key, URL-safe base64 */
export const VAPID_KEY = 'BCk-QqERU0q-CfYZjcuB6lnyyOYfJ2AifKqfeGIm7Z-HiTU5T9eTG5GxVA0_OH5mMlI4UkkDTpaZwozy0TzdZ2M';

export const idOf = (i: number) => (BASE_ID + BigInt(i)).toString();

/** Number of pictures on every third post (set from Server.images by mockMastodon) */
let imageCount = 1;
/** Aspect ratio (width / height) reported for the pictures (set from Server.aspect) */
let imageAspect = 4 / 3;
/** Whether posts divisible by 4 (with remainder 2) carry a content warning (set from Server.cw) */
let withCw = false;
/** Whether those content warnings are long (set from Server.cwLong) */
let longCw = false;
/** Whether the pictures are marked sensitive (set from Server.sensitive) */
let sensitiveMedia = false;
/** Whether posts with i % 5 === 3 carry a quote, code and a list (set from Server.formatted) */
let formatted = false;
/** Whether every post quotes another one (set from Server.quoteAll) */
let quoteAll = false;
/** Whether the posts answer the signed-in account, so their conversation can be muted (set from Server.muteThread) */
let muteThread = false;
/** Whether the conversations are muted (set from Server.threadMuted) */
let threadMuted = false;
/** The server-side filter that matches posts with i % 6 === 4 (set from Server.filter; a blur filter matches i % 6 === 0, posts that have a picture) */
let filter: Server['filter'];
/** Whether posts with i % 8 === 5 carry a link preview (set from Server.cards) */
let withCards = false;
/** Every post has a poll (set from Server.poll) */
let withPoll: Server['poll'];
let ownPosts = false;
/** Some posts (i % 5 === 2) have a hashtag (set from Server.hashtags) */
let withTags = false;
/** With hashtags: they are a paragraph of their own at the end of the post, not in the text (set from Server.hashtagLine) */
let tagLine = false;
/** With hashtags: #ronsu and #mastodon end the text, in its own paragraph (set from Server.hashtagEnd) */
let tagEnd = false;
let edited = false;
/** Polls of each upload (the file is ready on the second one) */
const polls: Record<string, number> = {};

/** As in the content of a post from another server: its own address for the hashtag and the name as its author wrote it, while `tags` has the name in lower case and the address of the signed-in account's server */
const tagLink = (name: string) => {
  const written = name[0].toUpperCase() + name.slice(1);
  return `<a href="https://remote.example/tags/${written}" class="mention hashtag" rel="tag">#<span>${written}</span></a>`;
};

function status(i: number, withQuote = true) {
  return {
    quote: quoteAll && withQuote ? { state: 'accepted', quoted_status: status(i + 1000, false) } : null,
    id: idOf(i),
    uri: `${HOST}/s/${i}`,
    url: `${HOST}/s/${i}`,
    edited_at: edited ? new Date(Date.UTC(2026, 9, 4, 6, 0, 0) + i * 60_000).toISOString() : null,
    created_at: new Date(Date.UTC(2026, 9, 4, 5, 0, 0) + i * 60_000).toISOString(), // every post a minute after the previous
    account: { id: ownPosts ? '1' : '2', username: 'u', acct: 'u', display_name: 'U', avatar: '', url: '', emojis: [] },
    content: `<p>Post ${i}. ${i % 7 === 1 ? '<a class="u-url mention" href="https://mock.test/@maija" rel="nofollow" target="_blank">@<span>maija</span></a> ' : ''}${'Lorem ipsum dolor sit amet. '.repeat(6 + (i % 5))}${withTags && !tagLine && i % 5 === 2 ? (tagEnd ? `${tagLink('ronsu')} ${tagLink('mastodon')}` : tagLink('ronsu')) : ''}</p>${withTags && tagLine && i % 5 === 2 ? `<p>${tagLink('ronsu')} ${tagLink('mastodon')}</p>` : ''}${formatted && i % 5 === 3 ? '<blockquote><p>A quoted line of text that is long enough to wrap onto a second line when the column is narrow.</p></blockquote><pre><code>const x = 1;</code></pre><p>Inline <code>code</code>.</p><ul><li>one</li><li>two</li></ul>' : ''}`,
    spoiler_text: withCw && i % 4 === 2 ? (longCw ? 'food talk: a long warning that does not fit on one line next to the button, so it has to wrap onto several lines of text' : 'food talk') : '',
    sensitive: sensitiveMedia,
    visibility: 'public',
    in_reply_to_id: null,
    in_reply_to_account_id: muteThread ? '1' : null,
    muted: threadMuted,
    reblog: null,
    media_attachments:
      i % 3 === 0
        ? Array.from({ length: imageCount }, (_, k) => ({
            id: `m${i}_${k}`, type: 'image', url: `${HOST}/img/${i}_${k}.png`, preview_url: `${HOST}/img/${i}_${k}.png`,
            description: `image ${k + 1}`, meta: { small: { width: Math.round(400 * imageAspect), height: 400, aspect: imageAspect } },
          }))
        : [],
    emojis: [],
    tags: withTags && i % 5 === 2 ? (tagLine || tagEnd ? ['ronsu', 'mastodon'] : ['ronsu']).map((name) => ({ name, url: `${HOST}/tags/${name}` })) : [],
    mentions: i % 7 === 1 ? [{ id: '2', username: 'maija', acct: 'maija', url: 'https://mock.test/@maija' }] : [],
    replies_count: 0,
    reblogs_count: 0,
    quotes_count: 1,
    favourites_count: 0,
    poll: withPoll
      ? {
          id: `poll${i}`,
          expires_at: withPoll.expired ? null : new Date(Date.UTC(2099, 0, 1)).toISOString(),
          expired: !!withPoll.expired,
          multiple: !!withPoll.multiple,
          votes_count: 4,
          voters_count: 4,
          options: ['Tea', 'Coffee', 'Water'].map((title, k) => ({ title, votes_count: withPoll!.hideTotals && !withPoll!.expired ? null : [2, 1, 1][k] })),
          emojis: [],
          voted: !!withPoll.voted,
          own_votes: withPoll.voted ? [0] : [],
        }
      : null,
    card: withCards && i % 8 === 5
      ? { url: `${HOST}/story/${i}`, title: `Story ${i}`, description: 'About the story', type: 'link', provider_name: 'Mock News', image: `${HOST}/img/card${i}.png`, image_description: 'A harbour' }
      : null,
    filtered:
      filter && i % 6 === (filter.action === 'blur' ? 0 : 4)
        ? [{ filter: { id: '1', title: filter.title, context: filter.context ?? ['home', 'thread', 'account', 'notifications'], expires_at: null, filter_action: filter.action } }]
        : [],
  };
}

export interface Server {
  following?: boolean;
  requested?: boolean;
  total?: number; // number of posts on the timeline (default COUNT); raise it to let new posts arrive
  boosted?: boolean; // the newest post on each page is a boost by "Daniel"
  boostedQuote?: boolean; // the boosted post is itself a quote post (with `boosted`)
  quoteAll?: boolean; // every post quotes another post
  replyToOld?: boolean; // the newest post on each page replies to post 1, which is fetched separately
  formatted?: boolean; // some posts have a quote, a code block and a list
  sensitive?: boolean; // the pictures are marked sensitive
  cwLong?: boolean; // with `cw`: the warning text is long
  cw?: boolean; // some posts have a content warning
  cards?: boolean; // some posts (i % 8 === 5) have a link preview
  poll?: { multiple?: boolean; expired?: boolean; voted?: boolean; hideTotals?: boolean; own?: boolean }; // every post has a poll (hideTotals: no counts until it has ended)
  votes?: number[][]; // the choices of the votes on a poll
  pollLimits?: { max_options: number; max_characters_per_option: number; min_expiration: number; max_expiration: number } | null; // configuration.polls of the instance (Mastodon's defaults when not set; none when null)
  pollRefreshes?: number; // GET /polls/:id calls; the answer has more votes than the post had
  filter?: { title: string; action: string; context?: string[] }; // a server-side filter matches some posts
  branched?: boolean; // the thread has a deep chain of replies and a second reply to the selected post and a late reply
  aspect?: number; // aspect ratio of the pictures (default 4/3)
  images?: number; // pictures per post that has any (default 1)
  dupFields?: boolean; // the profile has two fields with the same name
  locked?: boolean; // the profile is locked: following is a request
  noFollowScope?: boolean; // 403: a token without the write:follows scope
  follows?: string[];
  noModerationScope?: boolean; // 403: a token without the write:mutes and write:blocks scopes
  moderations?: string[]; // mute, unmute, block, unblock
  muted?: boolean;
  blocked?: boolean;
  domainBlocked?: boolean;
  remoteAccount?: boolean; // the profile belongs to an account of another server
  muteThread?: boolean; // the posts answer the signed-in account
  threadMuted?: boolean; // the conversations are muted
  muteBodies?: Record<string, unknown>[]; // the bodies of the mute requests
  domainBlocks?: string[]; // block:domain and unblock:domain
  conversationMutes?: string[]; // mute and unmute of a conversation
  created?: { body: Record<string, unknown>; key: string | undefined }[]; // successful POST /statuses
  attempts?: (string | undefined)[]; // all attempts (Idempotency-Key)
  failPost?: boolean;
  emojiRequests?: number; // calls of GET /api/v1/custom_emojis
  accountSearches?: string[]; // queries of the account search behind mention suggestions
  uploads?: string[]; // names of the files uploaded (POST /api/v2/media)
  descriptions?: Record<string, string>; // PUT /api/v1/media/:id
  noMediaScope?: boolean; // 403: a token without the write:media scope
  processing?: boolean; // uploads answer 202 and the file is ready on the second poll
  actions?: string[]; // POST /statuses/:id/<action>
  edited?: boolean; // every post has been edited
  own?: boolean; // the posts are written by the signed-in account
  profileRequests?: Record<string, string>[]; // the queries of GET /accounts/2/statuses
  pinnedPost?: boolean; // the profile has post 12 pinned
  hashtags?: boolean; // some posts have the hashtag #ronsu
  hashtagEnd?: boolean; // with `hashtags`: the text of the posts ends with #ronsu and #mastodon, in the same paragraph
  hashtagLine?: boolean; // with `hashtags`: the posts end with a paragraph of #ronsu and #mastodon
  tagFollowing?: boolean; // the signed-in account follows #ronsu
  tagFollows?: string[]; // follow and unfollow of a hashtag
  tagTimelines?: { tag: string; maxId: string | null }[]; // GET /timelines/tag/:tag
  failTagFollow?: boolean;
  deleted?: string[]; // ids of DELETE /statuses/:id
  failDelete?: boolean;
  sourceCw?: string; // the content warning in GET /statuses/:id/source
  failSource?: boolean;
  failHistory?: boolean;
  edits?: { id: string; body: Record<string, any> }[]; // PUT /statuses/:id
  failEdit?: boolean;
  failActions?: boolean;
  privacy?: string; // the account's default posting privacy (source.privacy); 'public' when not set
  credentialsFail?: boolean; // verify_credentials answers 500
  revoke?: '200' | '403' | '500' | 'hang'; // the answer of POST /oauth/revoke (200 when not set)
  revoked?: string[]; // the tokens POST /oauth/revoke was called with
  marker: { last_read_id: string; version: number; updated_at: string } | null;
  posts: string[]; // POST /markers calls
  notifications?: number; // the id of the newest notification (GET /notifications?limit=1); there are none when not set
  notifMarker?: { last_read_id: string; version: number; updated_at: string } | null; // the notifications marker
  notifPosts?: string[]; // POST /markers calls for the notifications marker
  vapid?: string | false; // the server's VAPID key in the instance information (a key when not set); false: none
  push?: { endpoint: string; alerts: Record<string, boolean> } | null; // the push subscription of the login
  pushCalls?: { method: string; body: Record<string, any> }[]; // calls to /push/subscription
}

/** Mocks the Mastodon API. Post 0 is the oldest, COUNT-1 the newest. */
export async function mockMastodon(page: Page, server: Server) {
  imageCount = server.images ?? 1;
  imageAspect = server.aspect ?? 4 / 3;
  withCw = !!server.cw;
  longCw = !!server.cwLong;
  sensitiveMedia = !!server.sensitive;
  formatted = !!server.formatted;
  quoteAll = !!server.quoteAll;
  muteThread = !!server.muteThread;
  threadMuted = !!server.threadMuted;
  filter = server.filter;
  withCards = !!server.cards;
  withPoll = server.poll;
  edited = !!server.edited;
  ownPosts = !!server.own || !!server.poll?.own;
  withTags = !!server.hashtags;
  tagLine = !!server.hashtagLine;
  tagEnd = !!server.hashtagEnd;
  await page.route(`${HOST}/**`, async (route) => {
    const req = route.request();
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
      'access-control-expose-headers': 'Link',
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    const json = (body: unknown) =>
      route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });

    if (url.pathname.startsWith('/img/')) {
      await new Promise((r) => setTimeout(r, 400)); // images load with a delay, like in real life
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: PNG });
    }
    if (url.pathname === '/api/v1/markers') {
      if (req.method() === 'POST') {
        const body = JSON.parse(req.postData() ?? '{}');
        if (body.notifications) {
          server.notifMarker = { last_read_id: body.notifications.last_read_id, version: (server.notifMarker?.version ?? 0) + 1, updated_at: new Date().toISOString() };
          (server.notifPosts ??= []).push(body.notifications.last_read_id);
          return json({ notifications: server.notifMarker });
        }
        server.marker = { last_read_id: body.home.last_read_id, version: (server.marker?.version ?? 0) + 1, updated_at: new Date().toISOString() };
        server.posts.push(body.home.last_read_id);
        return json({ home: server.marker });
      }
      return json({
        ...(server.marker ? { home: server.marker } : {}),
        ...(url.searchParams.getAll('timeline[]').includes('notifications') && server.notifMarker ? { notifications: server.notifMarker } : {}),
      });
    }
    if (url.pathname === '/api/v1/timelines/home') {
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const idx = (id: string) => Number(BigInt(id) - BASE_ID);
      let from = 0;
      const total = server.total ?? COUNT; // posts 0..total-1 exist on the server
      let to = total; // [from, to)
      const minId = url.searchParams.get('min_id');
      const maxId = url.searchParams.get('max_id');
      let list: number[];
      if (minId) {
        from = idx(minId) + 1;
        list = range(from, Math.min(from + limit, total));
      } else if (maxId) {
        to = idx(maxId);
        list = range(Math.max(0, to - limit), to);
      } else {
        list = range(Math.max(0, total - limit), total);
      }
      const page = list.reverse().map(status); // newest first, like the real API
      // boosted: the newest post of the page is wrapped in a boost by another account (the wrapper keeps its id)
      if (server.boosted && page.length) {
        const inner = server.boostedQuote ? { ...page[0], quote: { state: 'accepted', quoted_status: status(1) } } : page[0];
        page[0] = { ...page[0], reblog: inner, account: { ...page[0].account, id: '9', acct: 'daniel', username: 'daniel', display_name: 'Daniel' } };
      }
      if (server.replyToOld && page.length) page[0] = { ...page[0], in_reply_to_id: idOf(1) };
      return json(page);
    }
    const rel = () => ({
      id: '2', following: !!server.following, requested: !!server.requested, followed_by: true, blocking: !!server.blocked, muting: !!server.muted, domain_blocking: !!server.domainBlocked,
    });
    if (url.pathname === '/api/v1/custom_emojis') {
      server.emojiRequests = (server.emojiRequests ?? 0) + 1;
      const emoji = (shortcode: string, category: string | null, visible = true) => ({ shortcode, url: `https://mock.test/${shortcode}.png`, static_url: `https://mock.test/${shortcode}.png`, visible_in_picker: visible, category });
      return json([emoji('blobcat', null), emoji('party', 'Fun'), emoji('blobhaj', 'Fun'), emoji('secret', null, false)]);
    }
    if (url.pathname === '/api/v1/accounts/search') {
      (server.accountSearches ??= []).push(url.searchParams.get('q') ?? '');
      const people = [
        { id: '21', username: 'maija', acct: 'maija', display_name: 'Maija' },
        { id: '22', username: 'matti', acct: 'matti@mastodon.example', display_name: 'Matti' },
      ];
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      return json(people.filter((p) => p.acct.startsWith(q)).map((p) => ({ ...p, avatar: '', url: `https://mock.test/@${p.username}`, emojis: [] })));
    }
    if (url.pathname === '/api/v1/accounts/relationships') return json([rel()]);
    const follow = url.pathname.match(/^\/api\/v1\/accounts\/2\/(follow|unfollow)$/);
    if (follow && req.method() === 'POST') {
      if (server.noFollowScope) {
        return route.fulfill({ status: 403, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"This action is outside the authorized scopes"}' });
      }
      (server.follows ??= []).push(follow[1]);
      const on = follow[1] === 'follow';
      server.following = on && !server.locked;
      server.requested = on && !!server.locked;
      return json(rel());
    }
    const moderate = url.pathname.match(/^\/api\/v1\/accounts\/2\/(mute|unmute|block|unblock)$/);
    if (moderate && req.method() === 'POST') {
      if (server.noModerationScope) {
        return route.fulfill({ status: 403, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"This action is outside the authorized scopes"}' });
      }
      (server.moderations ??= []).push(moderate[1]);
      if (moderate[1] === 'mute') (server.muteBodies ??= []).push(req.postDataJSON() ?? {});
      if (moderate[1].endsWith('mute')) server.muted = moderate[1] === 'mute';
      else {
        server.blocked = moderate[1] === 'block';
        if (server.blocked) server.following = false;
      }
      return json(rel());
    }
    if (url.pathname === '/api/v1/domain_blocks') {
      const on = req.method() === 'POST';
      (server.domainBlocks ??= []).push(`${on ? 'block' : 'unblock'}:${on ? req.postDataJSON().domain : url.searchParams.get('domain')}`);
      server.domainBlocked = on;
      return json({});
    }
    const threadMute = url.pathname.match(/^\/api\/v1\/statuses\/(\d+)\/(mute|unmute)$/);
    if (threadMute && req.method() === 'POST') {
      (server.conversationMutes ??= []).push(threadMute[2]);
      threadMuted = threadMute[2] === 'mute';
      return json({ ...status(0), id: threadMute[1], muted: threadMuted });
    }
    const tagTimeline = url.pathname.match(/^\/api\/v1\/timelines\/tag\/([^/]+)$/);
    if (tagTimeline) {
      const maxId = url.searchParams.get('max_id');
      (server.tagTimelines ??= []).push({ tag: decodeURIComponent(tagTimeline[1]), maxId });
      return json(maxId ? [] : Array.from({ length: 20 }, (_, k) => 29 - k).map(status)); // a full page, the oldest is post 10
    }
    const tagPath = url.pathname.match(/^\/api\/v1\/tags\/([^/]+)(?:\/(follow|unfollow))?$/);
    if (tagPath) {
      const action = tagPath[2];
      if (action && server.failTagFollow) return route.fulfill({ status: 422, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"Ei onnistu"}' });
      if (action) {
        (server.tagFollows ??= []).push(action);
        server.tagFollowing = action === 'follow';
      }
      return json({ name: decodeURIComponent(tagPath[1]), url: `${HOST}/tags/${tagPath[1]}`, history: [], following: !!server.tagFollowing });
    }
    if (url.pathname === '/api/v1/accounts/2/statuses') {
      const query = Object.fromEntries(url.searchParams);
      (server.profileRequests ??= []).push(query);
      if (query.pinned) return json(server.pinnedPost ? [12].map(status) : []); // post 12 is in the list too, as on a real server
      if (query.max_id) return json([]);
      // The tabs: posts (replies to others left out), media, and posts with replies, which answers late so a quick change of tab can be tested
      if (query.only_media) return json([12, 9, 6].map(status));
      if (query.exclude_replies) return json([14, 13, 12, 11, 10].map(status));
      await new Promise((r) => setTimeout(r, 400));
      return json([24, 23, 22, 21, 20].map(status));
    }
    if (url.pathname === '/api/v1/accounts/2' || url.pathname === '/api/v1/accounts/lookup') {
      return json({
        id: '2', username: 'u', acct: server.remoteAccount ? 'u@mastodon.example' : 'u', display_name: 'U', avatar: '', header: '', url: 'https://mock.test/@u', emojis: [],
        note: '<p>About me</p>',
        fields: server.dupFields ? [
          { name: 'Link', value: '<a href="https://example.org" target="_blank">example.org</a>', verified_at: null },
          { name: 'Link', value: '<a href="https://example.net" target="_blank">example.net</a>', verified_at: null },
        ] : [
          { name: 'Website', value: '<a href="https://example.org" rel="me nofollow noopener" target="_blank"><span class="invisible">https://</span><span>example.org</span></a>', verified_at: '2026-01-02T10:00:00.000Z' },
          { name: 'Pronouns', value: 'they/them', verified_at: null },
        ], followers_count: 10, following_count: 5, statuses_count: 1234,
        locked: !!server.locked, bot: false,
      });
    }
    if (url.pathname === '/api/v2/instance') {
      const vapid = server.vapid === false ? {} : { vapid: { public_key: server.vapid ?? VAPID_KEY } };
      const polls = server.pollLimits === null ? {} : { polls: server.pollLimits ?? { max_options: 4, max_characters_per_option: 50, min_expiration: 300, max_expiration: 2_629_746 } };
      return json({ configuration: { statuses: { max_characters: 500 }, ...polls, ...vapid } });
    }
    if (url.pathname === '/api/v1/notifications' && !url.searchParams.get('max_id')) {
      const newest = server.notifications;
      return json(newest === undefined ? [] : [{ id: String(newest), type: 'mention', created_at: new Date().toISOString(), account: { id: '2', username: 'u', acct: 'u', display_name: 'U', avatar: '', url: '', emojis: [] }, status: status(1) }]);
    }
    if (url.pathname === '/api/v1/push/subscription') {
      const body = req.postData() ? JSON.parse(req.postData()!) : {};
      (server.pushCalls ??= []).push({ method: req.method(), body });
      const subscription = () => ({ id: 1, endpoint: server.push!.endpoint, alerts: server.push!.alerts, server_key: VAPID_KEY });
      if (req.method() === 'GET') {
        return server.push ? json(subscription()) : route.fulfill({ status: 404, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"Record not found"}' });
      }
      if (req.method() === 'POST') server.push = { endpoint: body.subscription.endpoint, alerts: { ...body.data.alerts } };
      else if (req.method() === 'PUT') server.push = { endpoint: server.push!.endpoint, alerts: { ...body.data.alerts } };
      else server.push = null;
      return json(server.push ? subscription() : {});
    }
    if (url.pathname === '/api/v2/media' && req.method() === 'POST') {
      if (server.noMediaScope) {
        return route.fulfill({ status: 403, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"This action is outside the authorized scopes"}' });
      }
      const name = /filename="([^"]*)"/.exec(req.postData() ?? '')?.[1] ?? 'file';
      (server.uploads ??= []).push(name);
      const id = `up${server.uploads.length}`;
      polls[id] = 0;
      return route.fulfill({
        status: server.processing ? 202 : 200, headers: { ...cors, 'content-type': 'application/json' },
        body: JSON.stringify({ id, type: 'image', url: server.processing ? null : `${HOST}/img/${id}.png`, preview_url: `${HOST}/img/${id}.png`, description: null }),
      });
    }
    const media = url.pathname.match(/^\/api\/v1\/media\/(\w+)$/);
    if (media && req.method() === 'PUT') {
      (server.descriptions ??= {})[media[1]] = JSON.parse(req.postData() ?? '{}').description;
      return json({ id: media[1], type: 'image', url: `${HOST}/img/${media[1]}.png`, preview_url: '', description: server.descriptions[media[1]] });
    }
    if (media && req.method() === 'GET') {
      const ready = ++polls[media[1]] >= 2;
      return json({ id: media[1], type: 'image', url: ready ? `${HOST}/img/${media[1]}.png` : null, preview_url: '', description: null });
    }
    if (url.pathname === '/api/v1/statuses' && req.method() === 'POST') {
      const key = req.headers()['idempotency-key'];
      (server.attempts ??= []).push(key);
      if (server.failPost) {
        return route.fulfill({ status: 422, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"Server refused"}' });
      }
      const body = JSON.parse(req.postData() ?? '{}');
      (server.created ??= []).push({ body, key });
      const n = COUNT + server.created.length - 1;
      return json({ ...status(0), id: idOf(n), content: `<p>${body.status}</p>`, in_reply_to_id: body.in_reply_to_id ?? null });
    }
    const ctxMatch = url.pathname.match(/^\/api\/v1\/statuses\/(\d+)\/context$/);
    if (ctxMatch) {
      const i = Number(BigInt(ctxMatch[1]) - BASE_ID);
      const own = (server.created ?? [])
        .map((c, k) => ({ ...status(0), id: idOf(COUNT + k), content: `<p>${c.body.status}</p>`, in_reply_to_id: c.body.in_reply_to_id as string }))
        .filter((s) => s.in_reply_to_id === ctxMatch[1]);
      return json({
        ancestors: [{ ...status(i - 2) }, { ...status(i - 1), in_reply_to_id: idOf(i - 2) }],
        descendants: [
          { ...status(i + 1), in_reply_to_id: idOf(i) },
          { ...status(i + 2), in_reply_to_id: idOf(i + 1) },
          ...(server.branched
            ? [
                { ...status(i + 3), in_reply_to_id: idOf(i + 2) },
                { ...status(i + 4), in_reply_to_id: idOf(i + 3) },
                { ...status(i + 5), in_reply_to_id: idOf(i + 4) },
                { ...status(i + 6), in_reply_to_id: idOf(i) },
                { ...status(i + 7), in_reply_to_id: idOf(i + 1) }, // listed late: it belongs under 151
                { ...status(i + 8), in_reply_to_id: idOf(i + 6) }, // a reply to 156, which starts a discussion of its own
              ]
            : []),
          ...own,
        ],
      });
    }
    const source = url.pathname.match(/^\/api\/v1\/statuses\/(\d+)\/source$/);
    if (source && req.method() === 'GET') {
      if (server.failSource) return route.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"Ei onnistu"}' });
      return json({ id: source[1], text: 'The text as written', spoiler_text: server.sourceCw ?? '' });
    }
    const history = url.pathname.match(/^\/api\/v1\/statuses\/(\d+)\/history$/);
    if (history && req.method() === 'GET') {
      if (server.failHistory) return route.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"Ei onnistu"}' });
      const author = { id: '2', username: 'u', acct: 'u', display_name: 'U', avatar: '', url: '', emojis: [] };
      const version = (n: number, over: Record<string, unknown>) => ({
        content: `<p>Version ${n}</p>`, spoiler_text: '', sensitive: false, created_at: new Date(Date.UTC(2026, 9, 4, 5 + n, 0, 0)).toISOString(),
        account: author, media_attachments: [], emojis: [], poll: null, ...over,
      });
      // The oldest first, as the server lists them
      return json([
        version(0, {}),
        version(1, { spoiler_text: 'food talk', media_attachments: [{ id: 'h1', type: 'image', url: `${HOST}/img/h.png`, preview_url: `${HOST}/img/h.png`, description: 'a picture' }] }),
        version(2, { poll: { options: [{ title: 'Tea' }, { title: 'Coffee' }] } }),
      ]);
    }
    const put = url.pathname.match(/^\/api\/v1\/statuses\/(\d+)$/);
    if (put && req.method() === 'PUT') {
      if (server.failEdit) return route.fulfill({ status: 422, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"Validation failed"}' });
      const body = JSON.parse(req.postData() ?? '{}');
      (server.edits ??= []).push({ id: put[1], body });
      return json({ ...status(Number(BigInt(put[1]) - BASE_ID)), content: `<p>${body.status}</p>`, spoiler_text: body.spoiler_text, edited_at: new Date().toISOString() });
    }
    const del = url.pathname.match(/^\/api\/v1\/statuses\/(\d+)$/);
    if (del && req.method() === 'DELETE') {
      if (server.failDelete) {
        return route.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"Ei onnistu"}' });
      }
      (server.deleted ??= []).push(del[1]);
      return json({ ...status(Number(BigInt(del[1]) - BASE_ID)), text: 'Post' });
    }
    const act = url.pathname.match(/^\/api\/v1\/statuses\/(\d+)\/(favourite|unfavourite|reblog|unreblog|bookmark|unbookmark)$/);
    if (act && req.method() === 'POST') {
      if (server.failActions) {
        return route.fulfill({ status: 422, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"Ei onnistu"}' });
      }
      (server.actions ??= []).push(`${act[2]}:${act[1]}`);
      return json(status(Number(BigInt(act[1]) - BASE_ID)));
    }
    const pollGet = url.pathname.match(/^\/api\/v1\/polls\/poll(\d+)$/);
    if (pollGet && req.method() === 'GET') {
      if (server.failActions) {
        return route.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"Ei onnistu"}' });
      }
      server.pollRefreshes = (server.pollRefreshes ?? 0) + 1;
      return json({
        ...status(Number(pollGet[1])).poll,
        voted: true,
        own_votes: [0],
        votes_count: 10,
        voters_count: 10,
        options: ['Tea', 'Coffee', 'Water'].map((title, k) => ({ title, votes_count: [6, 3, 1][k] })),
      });
    }
    const vote = url.pathname.match(/^\/api\/v1\/polls\/poll(\d+)\/votes$/);
    if (vote && req.method() === 'POST') {
      if (server.failActions) {
        return route.fulfill({ status: 422, headers: { ...cors, 'content-type': 'application/json' }, body: '{"error":"Ei onnistu"}' });
      }
      const choices: number[] = JSON.parse(req.postData() ?? '{}').choices;
      (server.votes ??= []).push(choices);
      return json({
        ...status(Number(vote[1])).poll,
        voted: true,
        own_votes: choices,
        votes_count: 5,
        voters_count: 5,
        options: ['Tea', 'Coffee', 'Water'].map((title, k) => ({ title, votes_count: [2, 1, 1][k] + (choices.includes(k) ? 1 : 0) })),
      });
    }
    const m = url.pathname.match(/^\/api\/v1\/statuses\/(\d+)$/);
    if (m) {
      const replies = (server.created ?? []).filter((c) => c.body.in_reply_to_id === m[1]).length;
      return json({ ...status(Number(BigInt(m[1]) - BASE_ID)), replies_count: replies });
    }
    if (url.pathname === '/api/v1/accounts/verify_credentials') {
      if (server.credentialsFail) return route.fulfill({ status: 500, headers: cors, body: '{"error":"boom"}' });
      return json({ id: '1', acct: 'me', source: { privacy: server.privacy ?? 'public' } });
    }
    if (url.pathname === '/oauth/revoke' && req.method() === 'POST') {
      (server.revoked ??= []).push(JSON.parse(req.postData() ?? '{}').token);
      if (server.revoke === 'hang') return new Promise(() => {});
      const status = Number(server.revoke ?? 200);
      return route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: status === 200 ? '{}' : '{"error":"no"}' });
    }
    return route.fulfill({ status: 404, headers: cors, body: '{"error":"not found"}' });
  });
}

function range(a: number, b: number) {
  return Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);
}

/** Stores the account in IndexedDB in the same format as the app (idb-keyval). */
export async function seedAccount(page: Page, scopes: string = SCOPES) {
  await page.goto('/');
  await page.evaluate(async (scopes) => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const r = indexedDB.open('keyval-store');
      r.onupgradeneeded = () => r.result.createObjectStore('keyval');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const acc = {
      key: 'mock.test|1', instance: 'mock.test', clientId: 'c', clientSecret: 's', token: 't',
      accountId: '1', acct: 'me', displayName: 'Me', avatar: '', scopes,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put([acc], 'accounts');
      tx.objectStore('keyval').put('mock.test|1', 'active-account');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, scopes);
}

/**
 * Reads to the end of the feed the way a reader does now that nothing loads by scrolling: down to the bottom, press
 * "Load more" if it is there, and again until the "all caught up" message shows.
 */
export async function toEnd(page: Page, rounds = 40) {
  const caughtUp = page.getByText('You are all caught up.');
  for (let i = 0; i < rounds; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    if (await caughtUp.isVisible()) return;
    const more = page.getByRole('button', { name: 'Load more' });
    if (await more.isVisible()) await more.evaluate((el: HTMLElement) => el.click());
    else await page.waitForTimeout(150);
  }
}
