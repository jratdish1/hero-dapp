/**
 * Mention Scheduler — Auto-refreshes Twitter mentions on a configurable interval.
 * 
 * DRY: Reuses twitterFetcher + db helpers. No duplicate fetch logic.
 * KISS: Simple setInterval, no external cron dependency.
 */

import { getHeroRestId, fetchHeroTweets, toDbRecord } from "./twitterFetcher";
import { upsertInfluencerMention, getInfluencerMentionByTweetId } from "./db";
import { alertNewMention } from "./telegramBot";
import { notifyOwner } from "./_core/notification";

// Default: every 4 hours (in ms)
const DEFAULT_INTERVAL_MS = 4 * 60 * 60 * 1000;
const FETCH_COUNT = 40;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let lastRunAt: Date | null = null;
let lastRunResult: { fetched: number; newCount: number; alertsSent: number } | null = null;

/** Single refresh cycle — fetch, store, alert */
async function runRefreshCycle(): Promise<void> {
  if (isRunning) {
    console.log("[MentionScheduler] Skipping — previous cycle still running");
    return;
  }

  isRunning = true;
  console.log("[MentionScheduler] Starting scheduled refresh...");

  try {
    const restId = await getHeroRestId();
    if (!restId) {
      console.warn("[MentionScheduler] Could not resolve @HERO501c3 — API rate limit may be hit");
      isRunning = false;
      return;
    }

    const tweets = await fetchHeroTweets(restId, FETCH_COUNT);
    let newCount = 0;
    let alertsSent = 0;

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

    lastRunAt = new Date();
    lastRunResult = { fetched: tweets.length, newCount, alertsSent };

    console.log(
      `[MentionScheduler] Done: ${tweets.length} fetched, ${newCount} new, ${alertsSent} alerts sent`
    );

    // Notify owner if significant new mentions found
    if (newCount >= 3) {
      await notifyOwner({
        title: `${newCount} New HERO Mentions Detected`,
        content: `Scheduled refresh found ${newCount} new mentions from ${tweets.length} total tweets. ${alertsSent} Telegram alerts sent.`,
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
  console.log(`[MentionScheduler] Starting — will refresh every ${intervalHours} hours`);

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
