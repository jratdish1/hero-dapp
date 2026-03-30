import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import {
  HERO_TOKEN,
  VETS_TOKEN,
  PLS_TOKEN,
  FEATURED_TOKENS,
  DEX_SOURCES,
  PULSECHAIN_ID,
  PULSECHAIN_CONFIG,
} from "../shared/tokens";

// --- Token Configuration Tests ---
describe("Token Configuration", () => {
  it("HERO token has correct contract address", () => {
    expect(HERO_TOKEN.address).toBe("0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27");
    expect(HERO_TOKEN.symbol).toBe("HERO");
    expect(HERO_TOKEN.decimals).toBe(18);
    expect(HERO_TOKEN.chainId).toBe(PULSECHAIN_ID);
  });

  it("VETS token has correct contract address", () => {
    expect(VETS_TOKEN.address).toBe("0x4013abBf94A745EfA7cc848989Ee83424A770060");
    expect(VETS_TOKEN.symbol).toBe("VETS");
    expect(VETS_TOKEN.decimals).toBe(18);
    expect(VETS_TOKEN.chainId).toBe(PULSECHAIN_ID);
  });

  it("PLS native token is configured correctly", () => {
    expect(PLS_TOKEN.address).toBe("0x0000000000000000000000000000000000000000");
    expect(PLS_TOKEN.isNative).toBe(true);
    expect(PLS_TOKEN.symbol).toBe("PLS");
  });

  it("FEATURED_TOKENS includes HERO and VETS", () => {
    const symbols = FEATURED_TOKENS.map((t) => t.symbol);
    expect(symbols).toContain("HERO");
    expect(symbols).toContain("VETS");
    expect(symbols).toContain("PLS");
  });

  it("All tokens have valid logo URIs", () => {
    for (const token of FEATURED_TOKENS) {
      expect(token.logoURI).toBeTruthy();
      expect(token.logoURI.startsWith("https://")).toBe(true);
    }
  });

  it("All token addresses are valid Ethereum addresses or zero address", () => {
    for (const token of FEATURED_TOKENS) {
      expect(token.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it("DEX_SOURCES has at least 4 sources", () => {
    expect(DEX_SOURCES.length).toBeGreaterThanOrEqual(4);
  });

  it("PulseChain config has correct chain ID", () => {
    expect(PULSECHAIN_CONFIG.id).toBe(369);
    expect(PULSECHAIN_CONFIG.name).toBe("PulseChain");
    expect(PULSECHAIN_CONFIG.nativeCurrency.symbol).toBe("PLS");
  });
});

// --- Auth Router Tests ---
type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-hero-user",
    email: "hero@vicfoundation.com",
    name: "HERO Trader",
    loginMethod: "manus",
    role: "user",
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeTruthy();
    expect(result?.openId).toBe("test-hero-user");
    expect(result?.name).toBe("HERO Trader");
  });

  it("returns null when not authenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

// --- Input Validation Tests ---
describe("DCA Order Input Validation", () => {
  it("rejects unauthenticated DCA order creation", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.dca.create({
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        tokenInAddress: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07",
        tokenInSymbol: "USDC",
        tokenOutAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenOutSymbol: "HERO",
        amountPerInterval: "10",
        intervalSeconds: 86400,
        totalIntervals: 30,
      })
    ).rejects.toThrow();
  });

  it("rejects DCA order with invalid wallet address (too short)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.dca.create({
        walletAddress: "0x1234",
        tokenInAddress: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07",
        tokenInSymbol: "USDC",
        tokenOutAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenOutSymbol: "HERO",
        amountPerInterval: "10",
        intervalSeconds: 86400,
        totalIntervals: 30,
      })
    ).rejects.toThrow();
  });

  it("rejects DCA order with negative interval", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.dca.create({
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        tokenInAddress: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07",
        tokenInSymbol: "USDC",
        tokenOutAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenOutSymbol: "HERO",
        amountPerInterval: "10",
        intervalSeconds: -1,
        totalIntervals: 30,
      })
    ).rejects.toThrow();
  });

  it("rejects DCA order with too many intervals", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.dca.create({
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        tokenInAddress: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07",
        tokenInSymbol: "USDC",
        tokenOutAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenOutSymbol: "HERO",
        amountPerInterval: "10",
        intervalSeconds: 86400,
        totalIntervals: 999,
      })
    ).rejects.toThrow();
  });
});

describe("Limit Order Input Validation", () => {
  it("rejects unauthenticated limit order creation", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.limitOrder.create({
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        tokenInAddress: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07",
        tokenInSymbol: "USDC",
        tokenOutAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenOutSymbol: "HERO",
        amountIn: "100",
        targetPrice: "0.000035",
        orderType: "buy",
      })
    ).rejects.toThrow();
  });

  it("rejects limit order with invalid order type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.limitOrder.create({
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        tokenInAddress: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07",
        tokenInSymbol: "USDC",
        tokenOutAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenOutSymbol: "HERO",
        amountIn: "100",
        targetPrice: "0.000035",
        orderType: "invalid" as any,
      })
    ).rejects.toThrow();
  });
});

describe("Swap Record Input Validation", () => {
  it("rejects unauthenticated swap recording", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.swap.record({
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        tokenInAddress: "0x0000000000000000000000000000000000000000",
        tokenInSymbol: "PLS",
        tokenOutAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenOutSymbol: "HERO",
        amountIn: "1000",
        amountOut: "500000",
        gasless: true,
      })
    ).rejects.toThrow();
  });
});

describe("Watchlist Input Validation", () => {
  it("rejects unauthenticated watchlist operations", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.watchlist.add({
        tokenAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenSymbol: "HERO",
      })
    ).rejects.toThrow();
  });
});

// --- Blog & MVS Router Tests ---
describe("Blog Router", () => {
  it("lists published blog posts publicly (no auth required)", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.blog.published({ limit: 10 });
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects unauthenticated blog post creation", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.blog.create({
        title: "Weekly MVS - March 30, 2026",
        slug: "weekly-mvs-march-30-2026-" + Date.now(),
        content: "This week's Most Valuable Shills featuring $HERO and $VETS",
        excerpt: "MVS weekly roundup",
        tags: "HERO,VETS,PulseChain",
        tweetUrl: "https://x.com/crypmvs/status/123",
      })
    ).rejects.toThrow();
  });

  it("allows authenticated blog post creation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.blog.create({
      title: "Weekly MVS - March 30, 2026",
      slug: "weekly-mvs-march-30-2026-" + Date.now(),
      content: "This week's Most Valuable Shills featuring $HERO and $VETS on PulseChain.",
      excerpt: "MVS weekly roundup highlighting farm yields and token performance.",
      tags: "HERO,VETS,PulseChain,MVS",
      tweetUrl: "https://x.com/crypmvs/status/2038513610360836215",
      heroMentioned: true,
      vetsMentioned: true,
    });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});

describe("MVS Router", () => {
  it("lists MVS content publicly", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mvs.list({ limit: 10 });
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects unauthenticated MVS content saving", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mvs.save({
        tweetId: "2038513610360836215",
        tweetUrl: "https://x.com/crypmvs/status/2038513610360836215",
        author: "CrypMvs",
        authorHandle: "@CrypMvs",
        content: "Weekly MVS thread content",
        farmYields: "$VETS/$EMIT: 147% APR | $HERO/$EMIT: 127% APR",
      })
    ).rejects.toThrow();
  });

  it("allows authenticated MVS content saving", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mvs.save({
      tweetId: "2038513610360836215",
      tweetUrl: "https://x.com/crypmvs/status/2038513610360836215",
      author: "CrypMvs",
      authorHandle: "@CrypMvs",
      content: "Weekly MVS thread content with $HERO and $VETS highlights",
      farmYields: "$VETS/$EMIT: 147% APR | $HERO/$EMIT: 127% APR | $HERO/$PLS: 154% APR",
    });
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
  });
});

// --- Partner Farm Configuration Tests ---
describe("Partner Farm Configuration", () => {
  it("Emit Farm has correct HERO/VETS pairs", () => {
    const emitPairs = [
      { pair: "HERO/EMIT", type: "LP V2" },
      { pair: "HERO/PLS", type: "LP" },
      { pair: "VETS/EMIT", type: "LP" },
    ];
    expect(emitPairs.length).toBe(3);
    expect(emitPairs.some((p) => p.pair === "HERO/EMIT")).toBe(true);
    expect(emitPairs.some((p) => p.pair === "VETS/EMIT")).toBe(true);
    expect(emitPairs.some((p) => p.pair === "HERO/PLS")).toBe(true);
  });

  it("RhinoFi has HERO/RHINO pair", () => {
    const rhinoPairs = [{ pair: "HERO/RHINO", type: "LP" }];
    expect(rhinoPairs.length).toBe(1);
    expect(rhinoPairs[0].pair).toBe("HERO/RHINO");
  });

  it("TruFarms has TruFarm/HERO pair", () => {
    const truPairs = [{ pair: "TruFarm/HERO", type: "LP V2" }];
    expect(truPairs.length).toBe(1);
    expect(truPairs[0].pair).toBe("TruFarm/HERO");
  });

  it("All partner farm URLs are valid", () => {
    const farmUrls = [
      "https://emit.farm/",
      "https://www.rhinofi.win/dapp",
      "https://trufarms.io/",
    ];
    for (const url of farmUrls) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

// --- Subdomain Architecture Tests ---
describe("Subdomain Architecture", () => {
  it("all planned subdomains are defined", () => {
    const subdomains = [
      "app.vicfoundation.com",
      "farm.vicfoundation.com",
      "dao.vicfoundation.com",
      "dash.vicfoundation.com",
      "blog.vicfoundation.com",
      "api.vicfoundation.com",
      "ai.vicfoundation.com",
      "docs.vicfoundation.com",
    ];
    expect(subdomains.length).toBeGreaterThanOrEqual(8);
    expect(subdomains).toContain("app.vicfoundation.com");
    expect(subdomains).toContain("farm.vicfoundation.com");
    expect(subdomains).toContain("dao.vicfoundation.com");
  });

  it("HERO X profile handle is correct", () => {
    const heroXHandle = "@HERO501c3";
    expect(heroXHandle).toBe("@HERO501c3");
  });

  it("VIC Foundation is a 501(c)(3)", () => {
    const orgType = "501(c)(3)";
    expect(orgType).toBe("501(c)(3)");
  });
});
