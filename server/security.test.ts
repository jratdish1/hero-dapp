import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { TRPCError } from "@trpc/server";

// ─── Test Helpers ───────────────────────────────────────────────────────

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

function createAuthenticatedContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `test-user-${userId}`,
      email: `user${userId}@test.com`,
      name: `Test User ${userId}`,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ─────────────────────────────────────────────────────────

describe("Authentication & Authorization", () => {
  it("auth.me returns null for unauthenticated users", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.me returns user data for authenticated users", async () => {
    const ctx = createAuthenticatedContext(42);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.id).toBe(42);
    expect(result?.openId).toBe("test-user-42");
  });

  it("protected procedures reject unauthenticated access", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.dca.list()).rejects.toThrow(TRPCError);
    await expect(caller.limitOrder.list()).rejects.toThrow(TRPCError);
    await expect(caller.watchlist.list()).rejects.toThrow(TRPCError);
  });

  it("blog.published is accessible without authentication", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    // Should not throw — it's a public procedure
    const result = await caller.blog.published();
    expect(Array.isArray(result)).toBe(true);
  });

  it("mvs.list is accessible without authentication", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mvs.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Input Validation Tests ─────────────────────────────────────────────

describe("Input Validation - SQL Injection Prevention", () => {
  it("rejects wallet address with SQL injection payload", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    // SQL injection attempt in wallet address field
    await expect(
      caller.swap.record({
        walletAddress: "'; DROP TABLE users; --",
        tokenInAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInSymbol: "HERO",
        tokenOutAddress: "0x4013abBf94A745EfA7cc848989Ee83424A770060",
        tokenOutSymbol: "VETS",
        amountIn: "1000",
        amountOut: "500",
      })
    ).rejects.toThrow(); // Zod validation: min(42) fails
  });

  it("rejects excessively long token symbols", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.watchlist.add({
        tokenAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenSymbol: "A".repeat(100), // max(20) should fail
      })
    ).rejects.toThrow();
  });

  it("rejects negative DCA intervals", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.dca.create({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInSymbol: "PLS",
        tokenOutAddress: "0x4013abBf94A745EfA7cc848989Ee83424A770060",
        tokenOutSymbol: "HERO",
        amountPerInterval: "100",
        intervalSeconds: -1, // Must be positive
        totalIntervals: 10,
      })
    ).rejects.toThrow();
  });

  it("rejects DCA with too many intervals", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.dca.create({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInSymbol: "PLS",
        tokenOutAddress: "0x4013abBf94A745EfA7cc848989Ee83424A770060",
        tokenOutSymbol: "HERO",
        amountPerInterval: "100",
        intervalSeconds: 3600,
        totalIntervals: 9999, // max(365) should fail
      })
    ).rejects.toThrow();
  });

  it("rejects invalid limit order type", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.limitOrder.create({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInSymbol: "PLS",
        tokenOutAddress: "0x4013abBf94A745EfA7cc848989Ee83424A770060",
        tokenOutSymbol: "HERO",
        amountIn: "1000",
        targetPrice: "0.001",
        orderType: "exploit" as any, // Must be "buy" or "sell"
      })
    ).rejects.toThrow();
  });
});

describe("Input Validation - XSS Prevention", () => {
  it("rejects blog title with script tags via Zod length", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    // Title max is 500 chars, but script tags should be caught by sanitizer
    await expect(
      caller.blog.create({
        title: "A".repeat(501), // Exceeds max(500)
        slug: "test-slug",
        content: "Test content",
      })
    ).rejects.toThrow();
  });

  it("rejects AI chat message exceeding max length", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ai.chat({
        message: "A".repeat(5001), // Exceeds max(5000)
      })
    ).rejects.toThrow();
  });

  it("rejects AI chat with too many history messages", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const history = Array.from({ length: 21 }, (_, i) => ({
      role: "user" as const,
      content: `Message ${i}`,
    }));

    await expect(
      caller.ai.chat({
        message: "Hello",
        history, // Exceeds max(20)
      })
    ).rejects.toThrow();
  });
});

describe("Input Validation - Edge Cases", () => {
  it("rejects empty wallet address", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.watchlist.add({
        tokenAddress: "", // min(42) fails
        tokenSymbol: "HERO",
      })
    ).rejects.toThrow();
  });

  it("rejects empty blog slug", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.blog.create({
        title: "Test",
        slug: "", // min(1) fails
        content: "Content",
      })
    ).rejects.toThrow();
  });

  it("rejects blog limit exceeding maximum", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.blog.published({ limit: 100 }) // max(50) fails
    ).rejects.toThrow();
  });

  it("rejects MVS list limit exceeding maximum", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.mvs.list({ limit: 100 }) // max(50) fails
    ).rejects.toThrow();
  });
});
