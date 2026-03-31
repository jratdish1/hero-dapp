/**
 * Twitter/X Influencer Mention Fetcher
 * 
 * Uses the built-in Data API to pull @HERO501c3 tweets (including RTs of mentions).
 * Parses tweet data, detects $HERO/$VETS mentions, classifies by type, and stores in DB.
 * 
 * DRY: Single parser for tweet data, reusable across all fetch paths.
 * KISS: One function to fetch, one to parse, one to store.
 */

import { callDataApi } from "./_core/dataApi";
import type { InsertInfluencerMention } from "../drizzle/schema";

// ─── Constants ──────────────────────────────────────────────────
const HERO_TWITTER_USERNAME = "HERO501c3";
const HERO_KEYWORDS = ["$HERO", "HERO501c3", "herobase", "hero token", "hero dex"];
const VETS_KEYWORDS = ["$VETS", "VetsInCrypto", "vets token"];
const INFLUENCER_FOLLOWER_THRESHOLD = 1000; // 1k+ followers = "influencer" category

// ─── Types ──────────────────────────────────────────────────────
interface RawTweetData {
  rest_id?: string;
  legacy?: {
    id_str?: string;
    full_text?: string;
    created_at?: string;
    retweet_count?: number;
    favorite_count?: number;
    reply_count?: number;
    quote_count?: number;
    retweeted_status_result?: { result?: RawTweetData };
    entities?: {
      media?: Array<{ media_url_https?: string; type?: string }>;
      user_mentions?: Array<{ screen_name?: string }>;
    };
    in_reply_to_status_id_str?: string;
  };
  core?: {
    user_results?: {
      result?: {
        rest_id?: string;
        legacy?: {
          screen_name?: string;
          name?: string;
          profile_image_url_https?: string;
          followers_count?: number;
        };
      };
    };
  };
}

export interface ParsedMention {
  tweetId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorProfileImageUrl: string;
  authorFollowerCount: number;
  tweetText: string;
  tweetUrl: string;
  tweetCreatedAt: Date | null;
  retweetCount: number;
  likeCount: number;
  replyCount: number;
  quoteCount: number;
  mediaUrls: string;
  mentionType: "direct_mention" | "retweet" | "quote" | "hero_tweet";
  category: "influencer" | "community" | "press" | "partner";
  heroMentioned: boolean;
  vetsMentioned: boolean;
}

// ─── Helpers (DRY) ──────────────────────────────────────────────

/** Check if text contains any keyword from a list (case-insensitive) */
function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

/** Classify follower count into category */
function classifyCategory(followerCount: number, username: string): "influencer" | "community" | "press" | "partner" {
  // Known press outlets
  const pressAccounts = ["coindesk", "cointelegraph", "theblock", "decrypt", "forbes", "bloomberg"];
  if (pressAccounts.some(p => username.toLowerCase().includes(p))) return "press";
  
  // Known partners
  const partnerAccounts = ["pulsex", "9inch", "libertyswap", "hexcrypto"];
  if (partnerAccounts.some(p => username.toLowerCase().includes(p))) return "partner";
  
  return followerCount >= INFLUENCER_FOLLOWER_THRESHOLD ? "influencer" : "community";
}

/** Parse Twitter date string to JS Date */
function parseTwitterDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr);
  } catch {
    return null;
  }
}

// ─── Core Parser (DRY — single source of truth for tweet parsing) ────

export function parseTweet(raw: RawTweetData): ParsedMention | null {
  const legacy = raw.legacy;
  if (!legacy) return null;

  const tweetId = legacy.id_str || raw.rest_id || "";
  if (!tweetId) return null;

  // Check if this is a retweet — if so, parse the original tweet
  const isRetweet = !!legacy.retweeted_status_result?.result;
  const sourceTweet = isRetweet ? legacy.retweeted_status_result!.result! : raw;
  const sourceLegacy = sourceTweet.legacy || legacy;

  // Extract author info from the source tweet (not the retweeter)
  const userResult = sourceTweet.core?.user_results?.result;
  const userLegacy = userResult?.legacy;

  const authorUsername = userLegacy?.screen_name || "unknown";
  const authorDisplayName = userLegacy?.name || authorUsername;
  const authorProfileImageUrl = userLegacy?.profile_image_url_https || "";
  const authorFollowerCount = userLegacy?.followers_count || 0;

  const tweetText = sourceLegacy.full_text || "";
  const tweetUrl = `https://x.com/${authorUsername}/status/${sourceLegacy.id_str || tweetId}`;

  // Extract media URLs
  const mediaEntities = sourceLegacy.entities?.media || [];
  const mediaUrls = mediaEntities
    .map(m => m.media_url_https)
    .filter(Boolean)
    .join(",");

  // Determine mention type
  let mentionType: ParsedMention["mentionType"] = "hero_tweet";
  if (isRetweet) {
    mentionType = "retweet";
  } else if (sourceLegacy.in_reply_to_status_id_str) {
    mentionType = "direct_mention"; // reply mentioning HERO
  } else if (authorUsername.toLowerCase() !== HERO_TWITTER_USERNAME.toLowerCase()) {
    mentionType = "quote";
  }

  // Detect token mentions
  const heroMentioned = containsAny(tweetText, HERO_KEYWORDS);
  const vetsMentioned = containsAny(tweetText, VETS_KEYWORDS);

  // Classify category
  const category = classifyCategory(authorFollowerCount, authorUsername);

  return {
    tweetId: sourceLegacy.id_str || tweetId,
    authorUsername,
    authorDisplayName,
    authorProfileImageUrl,
    authorFollowerCount,
    tweetText,
    tweetUrl,
    tweetCreatedAt: parseTwitterDate(sourceLegacy.created_at),
    retweetCount: sourceLegacy.retweet_count || 0,
    likeCount: sourceLegacy.favorite_count || 0,
    replyCount: sourceLegacy.reply_count || 0,
    quoteCount: sourceLegacy.quote_count || 0,
    mediaUrls,
    mentionType,
    category,
    heroMentioned,
    vetsMentioned,
  };
}

// ─── API Fetcher ────────────────────────────────────────────────

/** Get @HERO501c3 rest_id from username */
export async function getHeroRestId(): Promise<string | null> {
  try {
    const result = await callDataApi("Twitter/get_user_profile_by_username", {
      query: { username: HERO_TWITTER_USERNAME },
    }) as any;

    const userData = result?.result?.data?.user?.result;
    return userData?.rest_id || null;
  } catch (err) {
    console.error("[TwitterFetcher] Failed to get HERO rest_id:", err);
    return null;
  }
}

/** Fetch tweets from @HERO501c3 timeline (includes RTs of mentions) */
export async function fetchHeroTweets(restId: string, count = 20): Promise<ParsedMention[]> {
  try {
    const result = await callDataApi("Twitter/get_user_tweets", {
      query: { user: restId, count: String(count) },
    }) as any;

    const tweets: ParsedMention[] = [];

    // Parse the Twitter timeline response structure
    const instructions = result?.result?.timeline?.instructions || [];
    for (const instruction of instructions) {
      if (instruction.type !== "TimelineAddEntries") continue;
      const entries = instruction.entries || [];
      for (const entry of entries) {
        if (!entry.entryId?.startsWith("tweet-")) continue;
        const tweetResult = entry.content?.itemContent?.tweet_results?.result;
        if (!tweetResult) continue;

        const parsed = parseTweet(tweetResult);
        if (parsed) tweets.push(parsed);
      }
    }

    console.log(`[TwitterFetcher] Fetched ${tweets.length} tweets from @${HERO_TWITTER_USERNAME}`);
    return tweets;
  } catch (err) {
    console.error("[TwitterFetcher] Failed to fetch tweets:", err);
    return [];
  }
}

/** Convert ParsedMention to InsertInfluencerMention for DB storage */
export function toDbRecord(mention: ParsedMention): InsertInfluencerMention {
  return {
    tweetId: mention.tweetId,
    authorUsername: mention.authorUsername,
    authorDisplayName: mention.authorDisplayName,
    authorProfileImageUrl: mention.authorProfileImageUrl,
    authorFollowerCount: mention.authorFollowerCount,
    tweetText: mention.tweetText,
    tweetUrl: mention.tweetUrl,
    tweetCreatedAt: mention.tweetCreatedAt,
    retweetCount: mention.retweetCount,
    likeCount: mention.likeCount,
    replyCount: mention.replyCount,
    quoteCount: mention.quoteCount,
    mediaUrls: mention.mediaUrls || null,
    mentionType: mention.mentionType,
    category: mention.category,
    heroMentioned: mention.heroMentioned,
    vetsMentioned: mention.vetsMentioned,
    sentiment: "neutral",
    isHighlighted: false,
    isHidden: false,
  };
}
