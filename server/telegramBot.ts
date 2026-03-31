/**
 * Telegram Bot — Sends alerts to VetsInCrypto group when high-follower accounts mention $HERO.
 * 
 * DRY: Single sendMessage helper, reusable for any alert type.
 * KISS: Just sends formatted messages via the Bot API. No polling, no webhooks.
 */

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

// Follower threshold for triggering alerts (1k+)
const ALERT_FOLLOWER_THRESHOLD = 1000;

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

/** Get Telegram config from env — returns null if not configured */
export function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

/** Send a message to the configured Telegram chat */
export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string,
  parseMode: "HTML" | "MarkdownV2" = "HTML"
): Promise<boolean> {
  try {
    const url = `${TELEGRAM_API_BASE}${config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: false,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(`[TelegramBot] Failed to send (${response.status}): ${detail}`);
      return false;
    }

    console.log("[TelegramBot] Alert sent successfully");
    return true;
  } catch (err) {
    console.error("[TelegramBot] Error sending message:", err);
    return false;
  }
}

/** Format a mention alert as HTML for Telegram */
function formatMentionAlert(mention: {
  authorUsername: string;
  authorDisplayName: string;
  authorFollowerCount: number;
  tweetText: string;
  tweetUrl: string;
  heroMentioned: boolean;
  vetsMentioned: boolean;
  category: string;
}): string {
  const followerStr = mention.authorFollowerCount >= 1000
    ? `${(mention.authorFollowerCount / 1000).toFixed(1)}k`
    : String(mention.authorFollowerCount);

  const tokens = [
    mention.heroMentioned ? "$HERO" : "",
    mention.vetsMentioned ? "$VETS" : "",
  ].filter(Boolean).join(" & ");

  // Escape HTML entities in ALL user-generated content
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeName = esc(mention.authorDisplayName);
  const safeUsername = esc(mention.authorUsername);
  const safeText = esc(mention.tweetText).substring(0, 300);

  return [
    `🦸 <b>New ${mention.category.toUpperCase()} Mention!</b>`,
    ``,
    `👤 <b>${safeName}</b> (@${safeUsername})`,
    `📊 ${followerStr} followers`,
    tokens ? `🪙 Tokens: ${tokens}` : "",
    ``,
    `💬 <i>${safeText}${mention.tweetText.length > 300 ? "..." : ""}</i>`,
    ``,
    `🔗 <a href="${mention.tweetUrl}">View on X</a>`,
    ``,
    `#HERO #VetsInCrypto #PulseChain`,
  ].filter(Boolean).join("\n");
}

/** Check if a mention should trigger a Telegram alert */
export function shouldAlert(mention: {
  authorFollowerCount: number;
  category: string;
}): boolean {
  // Alert for influencers (1k+ followers) and all press/partner mentions
  return (
    mention.authorFollowerCount >= ALERT_FOLLOWER_THRESHOLD ||
    mention.category === "press" ||
    mention.category === "partner"
  );
}

/** Send a Telegram alert for a high-profile mention (if configured) */
export async function alertNewMention(mention: {
  authorUsername: string;
  authorDisplayName: string;
  authorFollowerCount: number;
  tweetText: string;
  tweetUrl: string;
  heroMentioned: boolean;
  vetsMentioned: boolean;
  category: string;
}): Promise<boolean> {
  const config = getTelegramConfig();
  if (!config) {
    console.log("[TelegramBot] Not configured — skipping alert");
    return false;
  }

  if (!shouldAlert(mention)) return false;

  const message = formatMentionAlert(mention);
  return sendTelegramMessage(config, message);
}
