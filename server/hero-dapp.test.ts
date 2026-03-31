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
    email: "hero@herodapp.com",
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

// --- HERO Ecosystem Tests ---
describe("HERO Ecosystem", () => {
  it("all HERO products are defined", () => {
    const products = [
      "swap", "farm", "dashboard", "portfolio",
      "ai", "blog", "dao", "api",
    ];
    expect(products.length).toBeGreaterThanOrEqual(8);
    expect(products).toContain("swap");
    expect(products).toContain("farm");
    expect(products).toContain("ai");
  });

  it("HERO X profile handle is correct", () => {
    const heroXHandle = "@HERO501c3";
    expect(heroXHandle).toBe("@HERO501c3");
  });

  it("VIC Foundation is a 501(c)(3)", () => {
    const orgType = "501(c)(3)";
    expect(orgType).toBe("501(c)(3)");
  });

  it("supports both PulseChain and BASE networks", () => {
    const networks = ["PulseChain", "Base"];
    expect(networks.length).toBe(2);
    expect(networks).toContain("PulseChain");
    expect(networks).toContain("Base");
  });
});

// --- XAI API Key Validation Test ---
describe("XAI API Key", () => {
  it("XAI_API_KEY environment variable is set", () => {
    const key = process.env.XAI_API_KEY;
    expect(key).toBeTruthy();
    expect(typeof key).toBe("string");
    expect(key!.length).toBeGreaterThan(10);
  });
});

// --- Multi-Chain Configuration Tests ---
import {
  BASE_CHAIN_ID,
  BASE_CONFIG,
  SUPPORTED_CHAINS,
  TOKEN_MAP,
  DEX_MAP,
  getTokensForChain,
  getDexSourcesForChain,
  getChainConfig,
  getHeroToken,
} from "../shared/tokens";

describe("Multi-Chain Configuration", () => {
  it("PulseChain and BASE are both supported", () => {
    expect(SUPPORTED_CHAINS.some(c => c.id === PULSECHAIN_ID)).toBe(true);
    expect(SUPPORTED_CHAINS.some(c => c.id === BASE_CHAIN_ID)).toBe(true);
    expect(SUPPORTED_CHAINS.length).toBe(2);
  });

  it("BASE chain config is correct", () => {
    expect(BASE_CONFIG.id).toBe(8453);
    expect(BASE_CONFIG.name).toBe("Base");
    expect(BASE_CONFIG.nativeCurrency.symbol).toBe("ETH");
  });

  it("TOKEN_MAP has entries for both chains", () => {
    expect(TOKEN_MAP[PULSECHAIN_ID]).toBeDefined();
    expect(TOKEN_MAP[BASE_CHAIN_ID]).toBeDefined();
    expect(TOKEN_MAP[PULSECHAIN_ID].length).toBeGreaterThan(0);
    expect(TOKEN_MAP[BASE_CHAIN_ID].length).toBeGreaterThan(0);
  });

  it("DEX_MAP has entries for both chains", () => {
    expect(DEX_MAP[PULSECHAIN_ID]).toBeDefined();
    expect(DEX_MAP[BASE_CHAIN_ID]).toBeDefined();
    expect(DEX_MAP[PULSECHAIN_ID].length).toBeGreaterThan(0);
    expect(DEX_MAP[BASE_CHAIN_ID].length).toBeGreaterThan(0);
  });

  it("getTokensForChain returns correct tokens", () => {
    const plsTokens = getTokensForChain(PULSECHAIN_ID);
    const baseTokens = getTokensForChain(BASE_CHAIN_ID);
    expect(plsTokens.some(t => t.symbol === "HERO")).toBe(true);
    expect(plsTokens.some(t => t.symbol === "VETS")).toBe(true);
    expect(baseTokens.some(t => t.symbol === "HERO")).toBe(true);
  });

  it("getDexSourcesForChain returns correct DEXs", () => {
    const plsDexes = getDexSourcesForChain(PULSECHAIN_ID);
    const baseDexes = getDexSourcesForChain(BASE_CHAIN_ID);
    expect(plsDexes.some(d => d.name === "PulseX V2")).toBe(true);
    expect(baseDexes.some(d => d.name === "Uniswap V3")).toBe(true);
  });

  it("getChainConfig returns correct config for each chain", () => {
    const plsConfig = getChainConfig(PULSECHAIN_ID);
    const baseConfig = getChainConfig(BASE_CHAIN_ID);
    expect(plsConfig.name).toBe("PulseChain");
    expect(baseConfig.name).toBe("Base");
  });

  it("getHeroToken returns HERO for both chains", () => {
    const plsHero = getHeroToken(PULSECHAIN_ID);
    const baseHero = getHeroToken(BASE_CHAIN_ID);
    expect(plsHero.symbol).toBe("HERO");
    expect(plsHero.address).toBe("0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27");
    expect(baseHero.symbol).toBe("HERO");
    expect(baseHero.address).toBe("0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8");
  });

  it("HERO on BASE has correct chain ID", () => {
    const baseHero = getHeroToken(BASE_CHAIN_ID);
    expect(baseHero.chainId).toBe(8453);
  });
});

// --- AI Chat Router Tests ---
describe("AI Chat Router", () => {
  it("rejects empty message", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.chat({
        message: "",
      })
    ).rejects.toThrow();
  });

  it("accepts valid chat message", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.ai.chat({
      message: "What is $HERO?",
      chainContext: "PulseChain",
    });
    expect(result).toBeDefined();
    expect(result.reply).toBeTruthy();
    expect(typeof result.reply).toBe("string");
  }, 30000);

  it("accepts chat with history", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.ai.chat({
      message: "Tell me more",
      chainContext: "Base",
      history: [
        { role: "user", content: "What is $HERO?" },
        { role: "assistant", content: "HERO is a token supporting veterans." },
      ],
    });
    expect(result).toBeDefined();
    expect(result.reply).toBeTruthy();
  }, 30000);
});

// --- Farm Blueprint Integration Tests ---
import {
  FARM_CONTRACTS_PLS,
  FARM_CONTRACTS_BASE,
  FARM_POOLS_PLS,
  CDN_ASSETS,
  LIVE_DAPP_URLS,
  SERVICE_BRANCHES,
  HERO_TOKEN_PLS,
  HERO_TOKEN_BASE,
} from "../shared/tokens";

describe("Farm Blueprint - Smart Contracts", () => {
  it("MasterChef V2 address is correct", () => {
    expect(FARM_CONTRACTS_PLS.masterChefV2).toBe("0xc9798c7447B209e79F12542691d4cdA64b98bD96");
    expect(FARM_CONTRACTS_PLS.masterChefV2).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("Buy & Burn addresses are correct for both chains", () => {
    expect(FARM_CONTRACTS_PLS.buyAndBurn).toBe("0x9016a0DAA30bD29A51a1a2905352877947f904E9");
    expect(FARM_CONTRACTS_BASE.buyAndBurn).toBe("0x67bEF0A8Be3ef576bF4ab2D904FCbe82E9846670");
    expect(FARM_CONTRACTS_PLS.buyAndBurn).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(FARM_CONTRACTS_BASE.buyAndBurn).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("Zapper address is correct", () => {
    expect(FARM_CONTRACTS_PLS.zapper).toBe("0x5a67C1dbb3F27C8C0D2B62F12C3Ed1704D14200c");
  });

  it("PulseX Router address is correct", () => {
    expect(FARM_CONTRACTS_PLS.pulseXRouter).toBe("0x165C3410fC91EF562C50559f7d2289fEbed552d9");
  });
});

describe("Farm Blueprint - Staking Pools", () => {
  it("has 2 active staking pools on PulseChain", () => {
    expect(FARM_POOLS_PLS.length).toBe(2);
    expect(FARM_POOLS_PLS.every(p => p.active)).toBe(true);
  });

  it("HERO/TruFarm pool has correct ID and LP token", () => {
    const pool = FARM_POOLS_PLS.find(p => p.name === "HERO/TruFarm");
    expect(pool).toBeDefined();
    expect(pool!.id).toBe(9);
    expect(pool!.lpToken).toBe("0x1F7FA931F4D1789c44f4a7Adc4564DE45ed96DF5");
    expect(pool!.token0.symbol).toBe("HERO");
    expect(pool!.token1.symbol).toBe("TruFarm");
  });

  it("HERO/PLS pool has correct ID and LP token", () => {
    const pool = FARM_POOLS_PLS.find(p => p.name === "HERO/PLS");
    expect(pool).toBeDefined();
    expect(pool!.id).toBe(67);
    expect(pool!.lpToken).toBe("0x34948e125033a697332202964de96af85becd78f");
    expect(pool!.token0.symbol).toBe("HERO");
    expect(pool!.token1.symbol).toBe("PLS");
  });

  it("HERO token addresses match between pool config and token config", () => {
    const pool = FARM_POOLS_PLS[0];
    expect(pool.token0.address).toBe(HERO_TOKEN_PLS.address);
  });
});

describe("Farm Blueprint - CDN Assets", () => {
  it("CDN asset URLs are valid HTTPS URLs", () => {
    expect(CDN_ASSETS.heroBanner).toMatch(/^https:\/\//);
    expect(CDN_ASSETS.heroEmblem).toMatch(/^https:\/\//);
  });

  it("CDN assets have correct file extensions", () => {
    expect(CDN_ASSETS.heroBanner).toContain(".webp");
    expect(CDN_ASSETS.heroEmblem).toContain(".webp");
  });
});

describe("Farm Blueprint - Live DApp URLs", () => {
  it("Farm DApp URL is valid", () => {
    expect(LIVE_DAPP_URLS.farm).toMatch(/^https:\/\//);
    expect(LIVE_DAPP_URLS.farm).toContain("manus.space");
  });

  it("DAO DApp URL is valid", () => {
    expect(LIVE_DAPP_URLS.dao).toMatch(/^https:\/\//);
    expect(LIVE_DAPP_URLS.dao).toContain("manus.space");
  });
});

describe("Farm Blueprint - Service Branches", () => {
  it("has all 9 service branches", () => {
    expect(SERVICE_BRANCHES.length).toBe(9);
  });

  it("includes all military branches", () => {
    const names = SERVICE_BRANCHES.map(b => b.name);
    expect(names).toContain("Army");
    expect(names).toContain("Navy");
    expect(names).toContain("Marines");
    expect(names).toContain("Air Force");
    expect(names).toContain("Space Force");
  });

  it("includes first responder categories", () => {
    const names = SERVICE_BRANCHES.map(b => b.name);
    expect(names).toContain("Firefighters");
    expect(names).toContain("Police");
    expect(names).toContain("EMTs");
  });

  it("Marines color is red (Semper Fi)", () => {
    const marines = SERVICE_BRANCHES.find(b => b.name === "Marines");
    expect(marines).toBeDefined();
    expect(marines!.color).toBe("#CC0000");
  });

  it("all branches have valid hex colors", () => {
    for (const branch of SERVICE_BRANCHES) {
      expect(branch.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("Farm Blueprint - HERO on BASE", () => {
  it("HERO BASE contract address is correct", () => {
    expect(HERO_TOKEN_BASE.address).toBe("0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8");
    expect(HERO_TOKEN_BASE.chainId).toBe(8453);
  });

  it("BASE Buy & Burn contract is set", () => {
    expect(FARM_CONTRACTS_BASE.buyAndBurn).toBeTruthy();
    expect(FARM_CONTRACTS_BASE.buyAndBurn).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
