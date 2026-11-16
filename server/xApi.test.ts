import { describe, it, expect, afterEach, vi } from "vitest";
import { toLegacyTweet, xApiConfigured, xGetUserTweetsLegacy } from "./xApi";
import { parseTweet } from "./twitterFetcher";

const includes = {
  users: [
    { id: "1", username: "CrypMvs", name: "MVS", profile_image_url: "https://img/1", public_metrics: { followers_count: 5000 } },
    { id: "2", username: "someone", name: "Someone", public_metrics: { followers_count: 10 } },
  ],
  media: [{ media_key: "m1", url: "https://pbs.twimg.com/a.jpg" }],
  tweets: [{ id: "99", text: "orig $HERO post", author_id: "2" }],
};

describe("xApi adapter", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.X_BEARER_TOKEN; });

  it("is off without X_BEARER_TOKEN", () => {
    delete process.env.X_BEARER_TOKEN;
    expect(xApiConfigured()).toBe(false);
  });

  it("maps a long Monster Thread (note_tweet) into the legacy shape parseTweet reads", () => {
    const legacy = toLegacyTweet(
      {
        id: "123",
        text: "truncated…",
        note_tweet: { text: "🚨 PulseChain Weekly Monster Thread #77 🚨 $HERO $VETS" },
        author_id: "1",
        created_at: "2026-11-15T17:00:00.000Z",
        attachments: { media_keys: ["m1"] },
        public_metrics: { retweet_count: 3, like_count: 9, reply_count: 1, quote_count: 0 },
      },
      includes,
    );
    expect(legacy.legacy.full_text).toContain("Monster Thread #77");
    expect(legacy.core.user_results.result.legacy.screen_name).toBe("CrypMvs");
    expect(legacy.legacy.entities.media[0].media_url_https).toBe("https://pbs.twimg.com/a.jpg");
    const parsed = parseTweet(legacy as any)!;
    expect(parsed.tweetUrl).toBe("https://x.com/CrypMvs/status/123");
    expect(parsed.heroMentioned).toBe(true);
    expect(parsed.vetsMentioned).toBe(true);
    expect(parsed.likeCount).toBe(9);
  });

  it("parses retweets as the original author", () => {
    const legacy = toLegacyTweet(
      { id: "200", text: "RT", author_id: "1", referenced_tweets: [{ type: "retweeted", id: "99" }] },
      includes,
    );
    const parsed = parseTweet(legacy as any)!;
    expect(parsed.mentionType).toBe("retweet");
    expect(parsed.authorUsername).toBe("someone");
  });

  it("sends the bearer token only in the Authorization header and never in the URL", async () => {
    process.env.X_BEARER_TOKEN = "test-token";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "5", text: "hi", author_id: "1" }], includes }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await xGetUserTweetsLegacy("1", 20);
    expect(out).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).not.toContain("test-token");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-token");
  });

  it("surfaces HTTP errors (401/402/429) without leaking the token", async () => {
    process.env.X_BEARER_TOKEN = "secret-xyz";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unauthorized", { status: 401, statusText: "Unauthorized" })));
    await expect(xGetUserTweetsLegacy("1")).rejects.toThrow(/401/);
    await expect(xGetUserTweetsLegacy("1")).rejects.not.toThrow(/secret-xyz/);
  });
});
