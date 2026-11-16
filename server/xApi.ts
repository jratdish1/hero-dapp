/**
 * X (Twitter) API v2 adapter for the HERO social feed.
 *
 * Replaces the retired Manus "Forge" Data API (BUILT_IN_FORGE_API_URL/KEY),
 * which went away with the Manus cut-over after the 2026-10-07 incident.
 * Output is converted into the legacy timeline shape that twitterFetcher.parseTweet
 * and mentionScheduler already understand, so no parser logic is duplicated.
 *
 * Secrets: X_BEARER_TOKEN is read from the server environment only. It is never
 * sent to the client, logged, or committed.
 */

const X_API_BASE = (process.env.X_API_BASE_URL || "https://api.x.com/2").replace(/\/$/, "");

const TWEET_FIELDS = [
  "created_at",
  "public_metrics",
  "entities",
  "referenced_tweets",
  "in_reply_to_user_id",
  "note_tweet",
  "author_id",
  "attachments",
].join(",");
const EXPANSIONS = [
  "author_id",
  "attachments.media_keys",
  "referenced_tweets.id",
  "referenced_tweets.id.author_id",
].join(",");
const USER_FIELDS = "username,name,profile_image_url,public_metrics";
const MEDIA_FIELDS = "url,preview_image_url,type";

export function xApiConfigured(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN && process.env.X_BEARER_TOKEN.trim());
}

type XUser = {
  id: string;
  username?: string;
  name?: string;
  profile_image_url?: string;
  public_metrics?: { followers_count?: number };
};
type XMedia = { media_key: string; url?: string; preview_image_url?: string };
type XTweet = {
  id: string;
  text?: string;
  note_tweet?: { text?: string };
  created_at?: string;
  author_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{ type: "retweeted" | "quoted" | "replied_to"; id: string }>;
  attachments?: { media_keys?: string[] };
  public_metrics?: {
    retweet_count?: number;
    like_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
};
type XTimelineResponse = {
  data?: XTweet[];
  includes?: { users?: XUser[]; media?: XMedia[]; tweets?: XTweet[] };
  errors?: Array<{ title?: string; detail?: string }>;
};

/** Legacy (GraphQL-style) tweet shape consumed by parseTweet / fetchCrypMvsContent. */
export type LegacyTweet = {
  rest_id: string;
  legacy: {
    id_str: string;
    full_text: string;
    created_at?: string;
    retweet_count: number;
    favorite_count: number;
    reply_count: number;
    quote_count: number;
    in_reply_to_status_id_str?: string;
    retweeted_status_result?: { result?: LegacyTweet };
    entities: { media: Array<{ media_url_https?: string; type?: string }> };
  };
  core: {
    user_results: {
      result: {
        rest_id: string;
        legacy: {
          screen_name: string;
          name: string;
          profile_image_url_https: string;
          followers_count: number;
        };
      };
    };
  };
};

async function xGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error("X_BEARER_TOKEN is not configured");
  const url = new URL(`${X_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) {
    // Never echo the token; status + short body is enough to diagnose 401/403/429.
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`X API ${path} failed (${res.status} ${res.statusText}) ${detail}`);
  }
  return (await res.json()) as T;
}

/** Resolve @username → numeric user id. */
export async function xGetUserId(username: string): Promise<string | null> {
  const clean = username.replace(/^@/, "");
  const out = await xGet<{ data?: { id?: string } }>(`/users/by/username/${encodeURIComponent(clean)}`, {});
  return out?.data?.id ?? null;
}

/** Convert one v2 tweet (+ includes) into the legacy shape. Exported for tests. */
export function toLegacyTweet(
  t: XTweet,
  includes: XTimelineResponse["includes"] = {},
  depth = 0,
): LegacyTweet {
  const users = new Map((includes.users ?? []).map(u => [u.id, u]));
  const media = new Map((includes.media ?? []).map(m => [m.media_key, m]));
  const refTweets = new Map((includes.tweets ?? []).map(rt => [rt.id, rt]));
  const author = (t.author_id && users.get(t.author_id)) || ({ id: t.author_id ?? "" } as XUser);

  const retweetRef = t.referenced_tweets?.find(r => r.type === "retweeted");
  const replyRef = t.referenced_tweets?.find(r => r.type === "replied_to");
  const retweeted = retweetRef ? refTweets.get(retweetRef.id) : undefined;

  const mediaEntities = (t.attachments?.media_keys ?? [])
    .map(k => media.get(k))
    .filter((m): m is XMedia => Boolean(m))
    .map(m => ({ media_url_https: m.url || m.preview_image_url, type: "photo" }));

  return {
    rest_id: t.id,
    legacy: {
      id_str: t.id,
      // note_tweet carries the full text of long posts (Monster Threads are long).
      full_text: t.note_tweet?.text || t.text || "",
      created_at: t.created_at,
      retweet_count: t.public_metrics?.retweet_count ?? 0,
      favorite_count: t.public_metrics?.like_count ?? 0,
      reply_count: t.public_metrics?.reply_count ?? 0,
      quote_count: t.public_metrics?.quote_count ?? 0,
      in_reply_to_status_id_str: replyRef?.id,
      retweeted_status_result:
        retweeted && depth === 0 ? { result: toLegacyTweet(retweeted, includes, depth + 1) } : undefined,
      entities: { media: mediaEntities },
    },
    core: {
      user_results: {
        result: {
          rest_id: author.id,
          legacy: {
            screen_name: author.username ?? "unknown",
            name: author.name ?? author.username ?? "unknown",
            profile_image_url_https: author.profile_image_url ?? "",
            followers_count: author.public_metrics?.followers_count ?? 0,
          },
        },
      },
    },
  };
}

/** Latest posts from one account, as legacy tweets (newest first). */
export async function xGetUserTweetsLegacy(userId: string, count = 20): Promise<LegacyTweet[]> {
  const max = Math.min(100, Math.max(5, count));
  const out = await xGet<XTimelineResponse>(`/users/${encodeURIComponent(userId)}/tweets`, {
    max_results: String(max),
    "tweet.fields": TWEET_FIELDS,
    expansions: EXPANSIONS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
  });
  return (out.data ?? []).map(t => toLegacyTweet(t, out.includes));
}
