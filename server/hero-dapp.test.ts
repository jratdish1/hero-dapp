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
