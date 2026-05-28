/**
 * Mention Scheduler — Auto-refreshes Twitter mentions on a configurable interval.
 * Also fetches @CrypMvs weekly threads for the Community Hub live feed.
 * 
 * DRY: Reuses twitterFetcher + db helpers. No duplicate fetch logic.
 * KISS: Simple setInterval, no external cron dependency.
 */

import { getHeroRestId, fetchHeroTweets, toDbRecord } from "./twitterFetcher";
import { upsertInfluencerMention, getInfluencerMentionByTweetId, saveMvsContent, getMvsContentByTweetId } from "./db";
import { alertNewMention } from "./telegramBot";
import { notifyOwner } from "./_core/notification";
import { callDataApi } from "./_core/dataApi";

// Default: every 4 hours (in ms)
const DEFAULT_INTERVAL_MS = 4 * 60 * 60 * 1000;
const FETCH_COUNT = 40;
const CRYPMVS_USERNAME = "CrypMvs";

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastRunAt: Date | null = null;
let lastRunResult: { fetched: number; newCount: number; alertsSent: number; mvsNew: number } | null = null;

/** Fetch @CrypMvs rest_id */
async function getCrypMvsRestId(): Promise<string | null> {
  try {
    const result = await callDataApi("Twitter/get_user_profile_by_username", {
      query: { username: CRYPMVS_USERNAME },
    }) as any;
    const userData = result?.result?.data?.user?.result;
    return userData?.rest_id || null;
  } catch (err) {
    console.error("[MentionScheduler] Failed to get @CrypMvs rest_id:", err);
    return null;
  }
}

/** Fetch @CrypMvs tweets and save to mvs_content table */
async function fetchCrypMvsContent(): Promise<number> {
  let newCount = 0;
  try {
    const restId = await getCrypMvsRestId();
    if (!restId) {
      console.warn("[MentionScheduler] Could not resolve @CrypMvs rest_id");
      return 0;
    }

    const result = await callDataApi("Twitter/get_user_tweets", {
      query: { user: restId, count: String(20) },
    }) as any;

    const instructions = result?.result?.timeline?.instructions || [];
    for (const instruction of instructions) {
      if (instruction.type !== "TimelineAddEntries") continue;
      const entries = instruction.entries || [];
      for (const entry of entries) {
        if (!entry.entryId?.startsWith("tweet-")) continue;
        const tweetResult = entry.content?.itemContent?.tweet_results?.result;
        if (!tweetResult) continue;

        const legacy = tweetResult.legacy;
        if (!legacy) continue;

        const tweetId = legacy.id_str || tweetResult.rest_id || "";
        if (!tweetId) continue;

        // Check if already saved
        const existing = await getMvsContentByTweetId(tweetId);
        if (existing) continue;

        const tweetText = legacy.full_text || "";
        const tweetUrl = `https://x.com/${CRYPMVS_USERNAME}/status/${tweetId}`;
        const createdAt = legacy.created_at ? new Date(legacy.created_at) : new Date();

        // Determine week label from content
        let weekLabel = "";
        const monsterMatch = tweetText.match(/Monster Thread #(\d+)/i);
        const roundupMatch = tweetText.match(/Roundup.*?(\w+ \d+)/i);
        if (monsterMatch) {
          weekLabel = `PulseChain: Weekly #${monsterMatch[1]}`;
        } else if (roundupMatch) {
          weekLabel = `HERO: Roundup`;
        } else if (tweetText.toLowerCase().includes("hero") || tweetText.toLowerCase().includes("vets")) {
          weekLabel = "$HERO: Update";
        }

        // Extract media URLs if any
        const mediaEntities = legacy.entities?.media || [];
        const mediaUrls = mediaEntities.map((m: any) => m.media_url_https).filter(Boolean).join(",");

        // Extract price mentions
        const heroPrice = tweetText.match(/\$HERO.*?\$([0-9.]+)/)?.[1] || "";
        const vetsPrice = tweetText.match(/\$VETS.*?\$([0-9.]+)/)?.[1] || "";

        await saveMvsContent({
          tweetId,
          tweetUrl,
          author: "CrypMvs",
          authorHandle: "@CrypMvs",
          content: tweetText,
          weekLabel: weekLabel || null,
          farmYields: tweetText.match(/\d+%\s*APR/g)?.join(" | ") || null,
          heroPrice: heroPrice || null,
          vetsPrice: vetsPrice || null,
          mediaUrls: mediaUrls || null,
        });
        newCount++;
      }
    }

    console.log(`[MentionScheduler] @CrypMvs: ${newCount} new posts saved to mvs_content`);
  } catch (err) {
    console.error("[MentionScheduler] Error fetching @CrypMvs:", err);
  }
  return newCount;
}

/** Single refresh cycle — fetch, store, alert */
async function runRefreshCycle(): Promise<void> {
  if (isRunning) {
    console.log("[MentionScheduler] Skipping — previous cycle still running");
    return;
  }

  isRunning = true;
  console.log("[MentionScheduler] Starting scheduled refresh...");

  try {
    // 1. Fetch @HERO501c3 mentions
    const restId = await getHeroRestId();
    if (!restId) {
      console.warn("[MentionScheduler] Could not resolve @HERO501c3 — API rate limit may be hit");
      // Still try to fetch @CrypMvs even if HERO fails
    }

    let newCount = 0;
    let alertsSent = 0;

    if (restId) {
      const tweets = await fetchHeroTweets(restId, FETCH_COUNT);
      for (const tweet of tweets) {
        const existing = await getInfluencerMentionByTweetId(tweet.tweetId);
        const isNew = !existing;

        await upsertInfluencerMention(toDbRecord(tweet));

        // Send Telegram alert for new high-profile mentions
        if (isNew) {
          newCount++;
          const sent = await alertNewMention(tweet);
          if (sent) alertsSent++;
        }
      }
    }

    // 2. Fetch @CrypMvs content for Community Hub
    const mvsNew = await fetchCrypMvsContent();

    lastRunAt = new Date();
    lastRunResult = { fetched: FETCH_COUNT, newCount, alertsSent, mvsNew };

    console.log(
      `[MentionScheduler] Done: ${newCount} new mentions, ${alertsSent} alerts, ${mvsNew} new @CrypMvs posts`
    );

    // Notify owner if significant new mentions found
    if (newCount >= 3) {
      await notifyOwner({
        title: `${newCount} New HERO Mentions Detected`,
        content: `Scheduled refresh found ${newCount} new mentions. ${alertsSent} Telegram alerts sent. ${mvsNew} new @CrypMvs posts saved.`,
      }).catch(() => {}); // Non-critical, don't break the cycle
    }
  } catch (err) {
    console.error("[MentionScheduler] Error during refresh cycle:", err);
  } finally {
    isRunning = false;
  }
}

/** Start the scheduled auto-refresh */
export function startMentionScheduler(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  if (schedulerTimer) {
    console.log("[MentionScheduler] Already running — stopping first");
    stopMentionScheduler();
  }

  const intervalHours = (intervalMs / (60 * 60 * 1000)).toFixed(1);
  console.log(`[MentionScheduler] Starting — will refresh every ${intervalHours} hours (HERO + CrypMvs)`);

  // Run first cycle after a 30-second delay (let server fully boot)
  setTimeout(() => {
    runRefreshCycle();
  }, 30_000);

  // Then run on interval
  schedulerTimer = setInterval(runRefreshCycle, intervalMs);
}

/** Stop the scheduler */
export function stopMentionScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[MentionScheduler] Stopped");
  }
}

/** Get scheduler status (for admin dashboard) */
export function getSchedulerStatus() {
  return {
    isActive: schedulerTimer !== null,
    isRunning,
    lastRunAt,
    lastRunResult,
    intervalMs: DEFAULT_INTERVAL_MS,
    intervalHours: DEFAULT_INTERVAL_MS / (60 * 60 * 1000),
  };
}
