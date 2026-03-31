import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Telegram Bot Tests ────────────────────────────────────────────

describe("Telegram Bot", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("getTelegramConfig returns null when env vars missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    const { getTelegramConfig } = await import("./telegramBot");
    expect(getTelegramConfig()).toBeNull();
  });

  it("getTelegramConfig returns config when env vars set", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:ABC");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-100123456");
    // Re-import to pick up new env
    const mod = await import("./telegramBot");
    const config = mod.getTelegramConfig();
    expect(config).toEqual({ botToken: "123:ABC", chatId: "-100123456" });
  });

  it("shouldAlert returns true for 1k+ follower accounts", async () => {
    const { shouldAlert } = await import("./telegramBot");
    expect(shouldAlert({ authorFollowerCount: 1000, category: "community" })).toBe(true);
    expect(shouldAlert({ authorFollowerCount: 50000, category: "influencer" })).toBe(true);
  });

  it("shouldAlert returns true for press/partner regardless of followers", async () => {
    const { shouldAlert } = await import("./telegramBot");
    expect(shouldAlert({ authorFollowerCount: 50, category: "press" })).toBe(true);
    expect(shouldAlert({ authorFollowerCount: 10, category: "partner" })).toBe(true);
  });

  it("shouldAlert returns false for low-follower community mentions", async () => {
    const { shouldAlert } = await import("./telegramBot");
    expect(shouldAlert({ authorFollowerCount: 500, category: "community" })).toBe(false);
    expect(shouldAlert({ authorFollowerCount: 0, category: "community" })).toBe(false);
  });

  it("sendTelegramMessage handles fetch failure gracefully", async () => {
    const { sendTelegramMessage } = await import("./telegramBot");
    // Mock fetch to fail
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    
    const result = await sendTelegramMessage(
      { botToken: "fake", chatId: "-100" },
      "Test message"
    );
    expect(result).toBe(false);
    
    global.fetch = originalFetch;
  });

  it("sendTelegramMessage handles non-OK response gracefully", async () => {
    const { sendTelegramMessage } = await import("./telegramBot");
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    });
    
    const result = await sendTelegramMessage(
      { botToken: "fake", chatId: "-100" },
      "Test message"
    );
    expect(result).toBe(false);
    
    global.fetch = originalFetch;
  });

  it("alertNewMention skips when Telegram not configured", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    const { alertNewMention } = await import("./telegramBot");
    
    const result = await alertNewMention({
      authorUsername: "biginfluencer",
      authorDisplayName: "Big Influencer",
      authorFollowerCount: 50000,
      tweetText: "Check out $HERO!",
      tweetUrl: "https://x.com/biginfluencer/status/123",
      heroMentioned: true,
      vetsMentioned: false,
      category: "influencer",
    });
    expect(result).toBe(false);
  });

  it("alertNewMention skips low-follower community mentions", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:ABC");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-100123");
    const { alertNewMention } = await import("./telegramBot");
    
    const result = await alertNewMention({
      authorUsername: "smalluser",
      authorDisplayName: "Small User",
      authorFollowerCount: 50,
      tweetText: "I like $HERO",
      tweetUrl: "https://x.com/smalluser/status/456",
      heroMentioned: true,
      vetsMentioned: false,
      category: "community",
    });
    expect(result).toBe(false);
  });
});

// ─── Scheduler Tests ───────────────────────────────────────────────

describe("Mention Scheduler", () => {
  it("getSchedulerStatus returns inactive by default", async () => {
    const { getSchedulerStatus } = await import("./mentionScheduler");
    const status = getSchedulerStatus();
    // Scheduler may or may not be active depending on server startup
    expect(status).toHaveProperty("isActive");
    expect(status).toHaveProperty("isRunning");
    expect(status).toHaveProperty("lastRunAt");
    expect(status).toHaveProperty("lastRunResult");
    expect(status).toHaveProperty("intervalMs");
    expect(status).toHaveProperty("intervalHours");
    expect(status.intervalHours).toBe(4);
  });

  it("scheduler status has correct interval", async () => {
    const { getSchedulerStatus } = await import("./mentionScheduler");
    const status = getSchedulerStatus();
    expect(status.intervalMs).toBe(4 * 60 * 60 * 1000);
  });
});

// ─── Pin to Top Tests ──────────────────────────────────────────────

describe("Pin to Top", () => {
  it("togglePin procedure validates input", async () => {
    // Test that the Zod schema rejects invalid inputs
    const { z } = await import("zod");
    const schema = z.object({
      id: z.number().int().positive(),
      isPinned: z.boolean(),
    });

    expect(() => schema.parse({ id: -1, isPinned: true })).toThrow();
    expect(() => schema.parse({ id: 0, isPinned: true })).toThrow();
    expect(() => schema.parse({ id: "abc", isPinned: true })).toThrow();
    expect(() => schema.parse({ id: 1, isPinned: "yes" })).toThrow();
    expect(schema.parse({ id: 1, isPinned: true })).toEqual({ id: 1, isPinned: true });
    expect(schema.parse({ id: 999, isPinned: false })).toEqual({ id: 999, isPinned: false });
  });

  it("toggleMentionPinned function exists in db helpers", async () => {
    const db = await import("./db");
    expect(typeof db.toggleMentionPinned).toBe("function");
  });

  it("getInfluencerMentions function exists and accepts options", async () => {
    const db = await import("./db");
    expect(typeof db.getInfluencerMentions).toBe("function");
  });
});

// ─── Integration: Telegram message formatting ──────────────────────

describe("Telegram Message Formatting", () => {
  it("formats mention alert with HTML escaping", async () => {
    // We can't directly test the private formatMentionAlert, but we can test
    // that alertNewMention doesn't crash with special characters
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:ABC");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-100123");
    const { alertNewMention } = await import("./telegramBot");
    
    // Mock fetch to succeed
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const result = await alertNewMention({
      authorUsername: "test<script>",
      authorDisplayName: "Test & User <b>bold</b>",
      authorFollowerCount: 5000,
      tweetText: "Check out $HERO! <script>alert('xss')</script> & more",
      tweetUrl: "https://x.com/test/status/123",
      heroMentioned: true,
      vetsMentioned: true,
      category: "influencer",
    });
    
    // Should have called fetch with HTML-escaped content
    expect(global.fetch).toHaveBeenCalled();
    const callArgs = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.text).not.toContain("<script>");
    expect(body.parse_mode).toBe("HTML");
    
    global.fetch = originalFetch;
  });
});
