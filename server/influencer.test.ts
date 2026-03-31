import { describe, it, expect, vi } from "vitest";
import { parseTweet, toDbRecord, type ParsedMention } from "./twitterFetcher";

// ─── parseTweet Tests ───────────────────────────────────────────────────

describe("parseTweet", () => {
  const makeTweet = (overrides: any = {}) => ({
    rest_id: "123456789",
    legacy: {
      id_str: "123456789",
      full_text: "Check out $HERO on PulseChain! @HERO501c3 is building something great.",
      created_at: "Mon Mar 30 12:00:00 +0000 2026",
      retweet_count: 10,
      favorite_count: 50,
      reply_count: 5,
      quote_count: 2,
      entities: {
        media: [{ media_url_https: "https://pbs.twimg.com/media/test.jpg", type: "photo" }],
        user_mentions: [{ screen_name: "HERO501c3" }],
      },
      ...overrides.legacy,
    },
    core: {
      user_results: {
        result: {
          rest_id: "987654321",
          legacy: {
            screen_name: "CryptoInfluencer",
            name: "Crypto Influencer",
            profile_image_url_https: "https://pbs.twimg.com/profile/test.jpg",
            followers_count: 50000,
            ...overrides.userLegacy,
          },
        },
      },
    },
  });

  it("parses a basic tweet correctly", () => {
    const result = parseTweet(makeTweet());
    expect(result).not.toBeNull();
    expect(result!.tweetId).toBe("123456789");
    expect(result!.authorUsername).toBe("CryptoInfluencer");
    expect(result!.authorDisplayName).toBe("Crypto Influencer");
    expect(result!.authorFollowerCount).toBe(50000);
    expect(result!.retweetCount).toBe(10);
    expect(result!.likeCount).toBe(50);
    expect(result!.replyCount).toBe(5);
    expect(result!.quoteCount).toBe(2);
  });

  it("detects $HERO mentions", () => {
    const result = parseTweet(makeTweet());
    expect(result!.heroMentioned).toBe(true);
  });

  it("detects $VETS mentions", () => {
    const tweet = makeTweet({ legacy: { full_text: "Loving $VETS and VetsInCrypto community!" } });
    const result = parseTweet(tweet);
    expect(result!.vetsMentioned).toBe(true);
  });

  it("classifies high-follower accounts as influencer", () => {
    const result = parseTweet(makeTweet({ userLegacy: { followers_count: 5000 } }));
    expect(result!.category).toBe("influencer");
  });

  it("classifies low-follower accounts as community", () => {
    const result = parseTweet(makeTweet({ userLegacy: { followers_count: 500 } }));
    expect(result!.category).toBe("community");
  });

  it("classifies press accounts correctly", () => {
    const result = parseTweet(makeTweet({ userLegacy: { screen_name: "CoinDesk_News", followers_count: 100000 } }));
    expect(result!.category).toBe("press");
  });

  it("classifies partner accounts correctly", () => {
    const result = parseTweet(makeTweet({ userLegacy: { screen_name: "PulseX_Official", followers_count: 20000 } }));
    expect(result!.category).toBe("partner");
  });

  it("extracts media URLs", () => {
    const result = parseTweet(makeTweet());
    expect(result!.mediaUrls).toContain("https://pbs.twimg.com/media/test.jpg");
  });

  it("builds correct tweet URL", () => {
    const result = parseTweet(makeTweet());
    expect(result!.tweetUrl).toBe("https://x.com/CryptoInfluencer/status/123456789");
  });

  it("parses retweets and extracts original author", () => {
    const rt = {
      rest_id: "rt_tweet_id",
      legacy: {
        id_str: "rt_tweet_id",
        full_text: "RT @OriginalPoster: $HERO is amazing!",
        created_at: "Mon Mar 30 12:00:00 +0000 2026",
        retweet_count: 0,
        favorite_count: 0,
        reply_count: 0,
        quote_count: 0,
        retweeted_status_result: {
          result: {
            rest_id: "original_tweet_id",
            legacy: {
              id_str: "original_tweet_id",
              full_text: "$HERO is amazing! Building for veterans.",
              created_at: "Sun Mar 29 10:00:00 +0000 2026",
              retweet_count: 100,
              favorite_count: 500,
              reply_count: 20,
              quote_count: 10,
              entities: {},
            },
            core: {
              user_results: {
                result: {
                  rest_id: "original_user_id",
                  legacy: {
                    screen_name: "OriginalPoster",
                    name: "Original Poster",
                    profile_image_url_https: "https://pbs.twimg.com/profile/original.jpg",
                    followers_count: 25000,
                  },
                },
              },
            },
          },
        },
        entities: {},
      },
      core: {
        user_results: {
          result: {
            rest_id: "retweeter_id",
            legacy: {
              screen_name: "HERO501c3",
              name: "HERO",
              profile_image_url_https: "https://pbs.twimg.com/profile/hero.jpg",
              followers_count: 10000,
            },
          },
        },
      },
    };

    const result = parseTweet(rt);
    expect(result).not.toBeNull();
    expect(result!.mentionType).toBe("retweet");
    expect(result!.authorUsername).toBe("OriginalPoster");
    expect(result!.authorFollowerCount).toBe(25000);
    expect(result!.likeCount).toBe(500);
  });

  it("returns null for tweets without legacy data", () => {
    const result = parseTweet({ rest_id: "123" } as any);
    expect(result).toBeNull();
  });

  it("returns null for tweets without id", () => {
    const result = parseTweet({ legacy: { full_text: "test" } } as any);
    expect(result).toBeNull();
  });

  it("handles missing author gracefully", () => {
    const tweet = {
      rest_id: "999",
      legacy: {
        id_str: "999",
        full_text: "Test tweet",
        created_at: "Mon Mar 30 12:00:00 +0000 2026",
        retweet_count: 0,
        favorite_count: 0,
        reply_count: 0,
        quote_count: 0,
        entities: {},
      },
      core: { user_results: { result: { legacy: {} } } },
    };
    const result = parseTweet(tweet as any);
    expect(result).not.toBeNull();
    expect(result!.authorUsername).toBe("unknown");
  });

  it("parses Twitter date strings correctly", () => {
    const result = parseTweet(makeTweet());
    expect(result!.tweetCreatedAt).toBeInstanceOf(Date);
  });
});

// ─── toDbRecord Tests ───────────────────────────────────────────────────

describe("toDbRecord", () => {
  const mockMention: ParsedMention = {
    tweetId: "123456",
    authorUsername: "TestUser",
    authorDisplayName: "Test User",
    authorProfileImageUrl: "https://example.com/img.jpg",
    authorFollowerCount: 5000,
    tweetText: "Test $HERO tweet",
    tweetUrl: "https://x.com/TestUser/status/123456",
    tweetCreatedAt: new Date("2026-03-30T12:00:00Z"),
    retweetCount: 10,
    likeCount: 50,
    replyCount: 5,
    quoteCount: 2,
    mediaUrls: "https://pbs.twimg.com/media/test.jpg",
    mentionType: "direct_mention",
    category: "influencer",
    heroMentioned: true,
    vetsMentioned: false,
  };

  it("converts ParsedMention to DB record", () => {
    const record = toDbRecord(mockMention);
    expect(record.tweetId).toBe("123456");
    expect(record.authorUsername).toBe("TestUser");
    expect(record.mentionType).toBe("direct_mention");
    expect(record.category).toBe("influencer");
    expect(record.heroMentioned).toBe(true);
    expect(record.vetsMentioned).toBe(false);
    expect(record.isHighlighted).toBe(false);
    expect(record.isHidden).toBe(false);
    expect(record.sentiment).toBe("neutral");
  });

  it("handles null mediaUrls", () => {
    const mention = { ...mockMention, mediaUrls: "" };
    const record = toDbRecord(mention);
    expect(record.mediaUrls).toBeNull();
  });

  it("preserves all engagement metrics", () => {
    const record = toDbRecord(mockMention);
    expect(record.retweetCount).toBe(10);
    expect(record.likeCount).toBe(50);
    expect(record.replyCount).toBe(5);
    expect(record.quoteCount).toBe(2);
  });
});

// ─── Input Validation Tests (tRPC schema) ───────────────────────────────

describe("influencer tRPC input validation", () => {
  const { z } = require("zod");

  const listSchema = z.object({
    category: z.enum(["influencer", "community", "press", "partner"]).optional(),
    limit: z.number().int().positive().max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }).optional();

  it("accepts valid list input", () => {
    expect(() => listSchema.parse({ category: "influencer", limit: 20, offset: 0 })).not.toThrow();
  });

  it("accepts empty input", () => {
    expect(() => listSchema.parse(undefined)).not.toThrow();
  });

  it("rejects invalid category", () => {
    expect(() => listSchema.parse({ category: "hacker" })).toThrow();
  });

  it("rejects negative offset", () => {
    expect(() => listSchema.parse({ offset: -1 })).toThrow();
  });

  it("rejects limit over 100", () => {
    expect(() => listSchema.parse({ limit: 200 })).toThrow();
  });

  const addManualSchema = z.object({
    tweetId: z.string().min(1).max(30),
    authorUsername: z.string().min(1).max(100),
    tweetText: z.string().max(5000),
    tweetUrl: z.string().url().max(500),
    category: z.enum(["influencer", "community", "press", "partner"]),
  });

  it("accepts valid manual mention input", () => {
    expect(() => addManualSchema.parse({
      tweetId: "123456789",
      authorUsername: "TestUser",
      tweetText: "Great $HERO content",
      tweetUrl: "https://x.com/TestUser/status/123456789",
      category: "press",
    })).not.toThrow();
  });

  it("rejects empty tweetId", () => {
    expect(() => addManualSchema.parse({
      tweetId: "",
      authorUsername: "TestUser",
      tweetText: "Test",
      tweetUrl: "https://x.com/test",
      category: "press",
    })).toThrow();
  });

  it("rejects invalid URL", () => {
    expect(() => addManualSchema.parse({
      tweetId: "123",
      authorUsername: "TestUser",
      tweetText: "Test",
      tweetUrl: "not-a-url",
      category: "press",
    })).toThrow();
  });

  it("rejects tweetText over 5000 chars", () => {
    expect(() => addManualSchema.parse({
      tweetId: "123",
      authorUsername: "TestUser",
      tweetText: "x".repeat(5001),
      tweetUrl: "https://x.com/test",
      category: "press",
    })).toThrow();
  });
});

// ─── Keyword Detection Tests ────────────────────────────────────────────

describe("keyword detection", () => {
  it("detects $HERO in various cases", () => {
    const cases = ["$HERO", "$hero", "$Hero", "Check $HERO out", "I love $hero token"];
    for (const text of cases) {
      const tweet = {
        rest_id: "1",
        legacy: { id_str: "1", full_text: text, created_at: "", retweet_count: 0, favorite_count: 0, reply_count: 0, quote_count: 0, entities: {} },
        core: { user_results: { result: { rest_id: "2", legacy: { screen_name: "test", name: "Test", followers_count: 100 } } } },
      };
      const result = parseTweet(tweet as any);
      expect(result!.heroMentioned).toBe(true);
    }
  });

  it("does not false-positive on unrelated text", () => {
    const tweet = {
      rest_id: "1",
      legacy: { id_str: "1", full_text: "Just a normal tweet about crypto", created_at: "", retweet_count: 0, favorite_count: 0, reply_count: 0, quote_count: 0, entities: {} },
      core: { user_results: { result: { rest_id: "2", legacy: { screen_name: "test", name: "Test", followers_count: 100 } } } },
    };
    const result = parseTweet(tweet as any);
    expect(result!.heroMentioned).toBe(false);
    expect(result!.vetsMentioned).toBe(false);
  });
});
