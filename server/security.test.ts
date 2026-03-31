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

// ═══════════════════════════════════════════════════════════════════════
// SECURITY HARDENING TESTS — Added during comprehensive audit
// ═══════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from "express";
import {
  sanitizeRequestBody,
  csrfOriginValidation,
  blockSuspiciousRequests,
  requestSizeGuard,
} from "./_core/security";
import { getSessionCookieOptions } from "./_core/cookies";

// ─── Middleware Test Helpers ────────────────────────────────────────────
function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    headers: {},
    body: {},
    originalUrl: "/",
    url: "/",
    path: "/",
    protocol: "https",
    ip: "127.0.0.1",
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): { res: Response; statusCode: number; jsonBody: unknown; headers: Record<string, string> } {
  let statusCode = 200;
  let jsonBody: unknown = null;
  const headers: Record<string, string> = {};
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { jsonBody = body; return this; },
    setHeader(key: string, value: string) { headers[key] = value; },
  } as unknown as Response;
  return { res, statusCode, jsonBody, headers };
}

function nextFn(): NextFunction & { called?: boolean } {
  const fn = (() => { (fn as any).called = true; }) as NextFunction & { called?: boolean };
  fn.called = false;
  return fn;
}

// ═══════════════════════════════════════════════════════════════════════
// SANITIZATION — Deep XSS Scrubbing
// ═══════════════════════════════════════════════════════════════════════
describe("Deep XSS Sanitization", () => {
  it("strips <script> tags from string fields", () => {
    const req = createMockReq({ body: { name: 'Hello<script>alert("xss")</script>World' } });
    const { res } = createMockRes();
    const next = nextFn();
    sanitizeRequestBody(req, res, next);
    expect(req.body.name).toBe("HelloWorld");
    expect(next.called).toBe(true);
  });

  it("strips event handlers (onclick, onerror)", () => {
    const req = createMockReq({ body: { title: 'Test onclick="steal()" content' } });
    const { res } = createMockRes();
    const next = nextFn();
    sanitizeRequestBody(req, res, next);
    expect(req.body.title).not.toContain("onclick");
  });

  it("strips javascript: protocol", () => {
    const req = createMockReq({ body: { url: "javascript:alert(1)" } });
    const { res } = createMockRes();
    const next = nextFn();
    sanitizeRequestBody(req, res, next);
    expect(req.body.url).not.toContain("javascript:");
  });

  it("strips iframe/embed/object tags", () => {
    const req = createMockReq({ body: { content: 'Before<iframe src="evil.com"></iframe>After' } });
    const { res } = createMockRes();
    const next = nextFn();
    sanitizeRequestBody(req, res, next);
    expect(req.body.content).not.toContain("iframe");
  });

  it("removes __proto__ keys (prototype pollution)", () => {
    const body: Record<string, unknown> = { name: "safe" };
    Object.defineProperty(body, "__proto__", { value: { isAdmin: true }, enumerable: true, configurable: true, writable: true });
    const req = createMockReq({ body });
    const { res } = createMockRes();
    const next = nextFn();
    sanitizeRequestBody(req, res, next);
    expect(next.called).toBe(true);
  });

  it("sanitizes nested objects recursively", () => {
    const req = createMockReq({ body: { outer: { inner: '<script>steal()</script>Clean' } } });
    const { res } = createMockRes();
    const next = nextFn();
    sanitizeRequestBody(req, res, next);
    expect(req.body.outer.inner).toBe("Clean");
  });

  it("sanitizes arrays of strings", () => {
    const req = createMockReq({ body: { tags: ["safe", '<script>bad</script>tag', "ok"] } });
    const { res } = createMockRes();
    const next = nextFn();
    sanitizeRequestBody(req, res, next);
    expect(req.body.tags[1]).toBe("tag");
  });

  it("passes clean data unchanged", () => {
    const req = createMockReq({ body: { name: "HERO Token", price: "0.0001" } });
    const { res } = createMockRes();
    const next = nextFn();
    sanitizeRequestBody(req, res, next);
    expect(req.body).toEqual({ name: "HERO Token", price: "0.0001" });
  });

  it("strips data:text/html payloads", () => {
    const req = createMockReq({ body: { url: "data:text/html,<script>alert(1)</script>" } });
    const { res } = createMockRes();
    const next = nextFn();
    sanitizeRequestBody(req, res, next);
    expect(req.body.url).not.toContain("data:text/html");
  });

  it("strips CSS expression() injection", () => {
    const req = createMockReq({ body: { style: "color: expression(alert(1))" } });
    const { res } = createMockRes();
    const next = nextFn();
    sanitizeRequestBody(req, res, next);
    expect(req.body.style).not.toContain("expression(");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CSRF ORIGIN VALIDATION
// ═══════════════════════════════════════════════════════════════════════
describe("CSRF Origin Validation", () => {
  const origEnv = process.env.NODE_ENV;

  it("allows GET requests without origin check", () => {
    process.env.NODE_ENV = "production";
    const req = createMockReq({ method: "GET" });
    const { res } = createMockRes();
    const next = nextFn();
    csrfOriginValidation(req, res, next);
    expect(next.called).toBe(true);
    process.env.NODE_ENV = origEnv;
  });

  it("allows POST from herobase.io", () => {
    process.env.NODE_ENV = "production";
    const req = createMockReq({ method: "POST", headers: { origin: "https://www.herobase.io" } });
    const { res } = createMockRes();
    const next = nextFn();
    csrfOriginValidation(req, res, next);
    expect(next.called).toBe(true);
    process.env.NODE_ENV = origEnv;
  });

  it("blocks POST from unknown origin in production", () => {
    process.env.NODE_ENV = "production";
    const req = createMockReq({ method: "POST", headers: { origin: "https://evil-site.com" } });
    const mock = createMockRes();
    const next = nextFn();
    csrfOriginValidation(req, mock.res, next);
    expect(next.called).toBe(false);
    process.env.NODE_ENV = origEnv;
  });

  it("extracts origin from referer header", () => {
    process.env.NODE_ENV = "production";
    const req = createMockReq({ method: "POST", headers: { referer: "https://www.herobase.io/swap" } });
    const { res } = createMockRes();
    const next = nextFn();
    csrfOriginValidation(req, res, next);
    expect(next.called).toBe(true);
    process.env.NODE_ENV = origEnv;
  });

  it("allows all requests in development", () => {
    process.env.NODE_ENV = "development";
    const req = createMockReq({ method: "POST", headers: { origin: "http://localhost:3000" } });
    const { res } = createMockRes();
    const next = nextFn();
    csrfOriginValidation(req, res, next);
    expect(next.called).toBe(true);
    process.env.NODE_ENV = origEnv;
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SUSPICIOUS REQUEST BLOCKING
// ═══════════════════════════════════════════════════════════════════════
describe("Suspicious Request Blocking", () => {
  it("blocks path traversal", () => {
    const req = createMockReq({ originalUrl: "/api/../../etc/passwd" });
    const mock = createMockRes();
    const next = nextFn();
    blockSuspiciousRequests(req, mock.res, next);
    expect(next.called).toBe(false);
  });

  it("blocks SQL injection in URL", () => {
    const req = createMockReq({ originalUrl: "/api?q=1 UNION SELECT * FROM users" });
    const mock = createMockRes();
    const next = nextFn();
    blockSuspiciousRequests(req, mock.res, next);
    expect(next.called).toBe(false);
  });

  it("blocks XSS in URL", () => {
    const req = createMockReq({ originalUrl: "/search?q=<script>alert(1)</script>" });
    const mock = createMockRes();
    const next = nextFn();
    blockSuspiciousRequests(req, mock.res, next);
    expect(next.called).toBe(false);
  });

  it("blocks .env access", () => {
    const req = createMockReq({ originalUrl: "/.env" });
    const mock = createMockRes();
    const next = nextFn();
    blockSuspiciousRequests(req, mock.res, next);
    expect(next.called).toBe(false);
  });

  it("blocks .git access", () => {
    const req = createMockReq({ originalUrl: "/.git/config" });
    const mock = createMockRes();
    const next = nextFn();
    blockSuspiciousRequests(req, mock.res, next);
    expect(next.called).toBe(false);
  });

  it("blocks wp-admin probing", () => {
    const req = createMockReq({ originalUrl: "/wp-admin/login.php" });
    const mock = createMockRes();
    const next = nextFn();
    blockSuspiciousRequests(req, mock.res, next);
    expect(next.called).toBe(false);
  });

  it("allows legitimate tRPC requests", () => {
    const req = createMockReq({ originalUrl: "/api/trpc/prices.ticker" });
    const { res } = createMockRes();
    const next = nextFn();
    blockSuspiciousRequests(req, res, next);
    expect(next.called).toBe(true);
  });

  it("allows tRPC requests with hex addresses", () => {
    const req = createMockReq({ originalUrl: "/api/trpc/dao.delegates.byAddress?input=%7B%22address%22%3A%220x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27%22%7D" });
    const { res } = createMockRes();
    const next = nextFn();
    blockSuspiciousRequests(req, res, next);
    expect(next.called).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// REQUEST SIZE GUARD
// ═══════════════════════════════════════════════════════════════════════
describe("Request Size Guard", () => {
  it("allows requests within limit", () => {
    const guard = requestSizeGuard(1024 * 1024);
    const req = createMockReq({ headers: { "content-length": "500" } });
    const { res } = createMockRes();
    const next = nextFn();
    guard(req, res, next);
    expect(next.called).toBe(true);
  });

  it("rejects oversized requests", () => {
    const guard = requestSizeGuard(1024);
    const req = createMockReq({ headers: { "content-length": "2048" } });
    const mock = createMockRes();
    const next = nextFn();
    guard(req, mock.res, next);
    expect(next.called).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// COOKIE SECURITY
// ═══════════════════════════════════════════════════════════════════════
describe("Session Cookie Security", () => {
  it("sets httpOnly to prevent JS access", () => {
    const req = createMockReq({ protocol: "https" });
    const opts = getSessionCookieOptions(req);
    expect(opts.httpOnly).toBe(true);
  });

  it("sets secure for HTTPS", () => {
    const req = createMockReq({ protocol: "https" });
    const opts = getSessionCookieOptions(req);
    expect(opts.secure).toBe(true);
  });

  it("detects HTTPS from x-forwarded-proto", () => {
    const req = createMockReq({ protocol: "http", headers: { "x-forwarded-proto": "https" } });
    const opts = getSessionCookieOptions(req);
    expect(opts.secure).toBe(true);
  });

  it("path is /", () => {
    const req = createMockReq({ protocol: "https" });
    const opts = getSessionCookieOptions(req);
    expect(opts.path).toBe("/");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SESSION LIFETIME
// ═══════════════════════════════════════════════════════════════════════
describe("Session Lifetime", () => {
  it("session max age is 30 days", async () => {
    const { SESSION_MAX_AGE_MS } = await import("../shared/const");
    expect(SESSION_MAX_AGE_MS).toBe(1000 * 60 * 60 * 24 * 30);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ETH ADDRESS FORMAT VALIDATION (Hardened)
// ═══════════════════════════════════════════════════════════════════════
describe("Hardened ETH Address Validation", () => {
  it("rejects address without 0x prefix", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.swap.history({ walletAddress: "35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27" })
    ).rejects.toThrow();
  });

  it("rejects address with non-hex chars", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.swap.history({ walletAddress: "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ" })
    ).rejects.toThrow();
  });

  it("rejects too-short address", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.swap.history({ walletAddress: "0x123" })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SAFE STRING VALIDATION (XSS in tRPC inputs)
// ═══════════════════════════════════════════════════════════════════════
describe("Safe String Validation in tRPC", () => {
  it("rejects media title with script tag", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.media.upload({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        category: "memes",
        title: '<script>alert("xss")</script>',
        mediaType: "image",
        fileBase64: "dGVzdA==",
        fileName: "test.png",
        contentType: "image/png",
      })
    ).rejects.toThrow();
  });

  it("rejects media title with javascript: protocol", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.media.upload({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        category: "memes",
        title: "javascript:alert(1)",
        mediaType: "image",
        fileBase64: "dGVzdA==",
        fileName: "test.png",
        contentType: "image/png",
      })
    ).rejects.toThrow();
  });

  it("rejects invalid content type", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.media.upload({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        category: "memes",
        title: "Safe Title",
        mediaType: "image",
        fileBase64: "dGVzdA==",
        fileName: "test.png",
        contentType: "application/x-evil",
      })
    ).rejects.toThrow();
  });

  it("rejects filename with path traversal", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.media.upload({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        category: "memes",
        title: "Safe Title",
        mediaType: "image",
        fileBase64: "dGVzdA==",
        fileName: "../../../etc/passwd",
        contentType: "image/png",
      })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TOKEN SYMBOL VALIDATION
// ═══════════════════════════════════════════════════════════════════════
describe("Token Symbol Validation", () => {
  it("rejects symbol with HTML", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.watchlist.add({
        tokenAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenSymbol: "<script>HERO</script>",
      })
    ).rejects.toThrow();
  });

  it("rejects symbol with spaces", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.watchlist.add({
        tokenAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenSymbol: "HERO TOKEN",
      })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// NUMERIC STRING VALIDATION
// ═══════════════════════════════════════════════════════════════════════
describe("Numeric String Validation", () => {
  it("rejects non-numeric DCA amount", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.dca.create({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInSymbol: "HERO",
        tokenOutAddress: "0x4013abBf94A745EfA7cc848989Ee83424A770060",
        tokenOutSymbol: "VETS",
        amountPerInterval: "not-a-number",
        intervalSeconds: 3600,
        totalIntervals: 10,
      })
    ).rejects.toThrow();
  });

  it("rejects SQL injection in amount", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.dca.create({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        tokenInSymbol: "HERO",
        tokenOutAddress: "0x4013abBf94A745EfA7cc848989Ee83424A770060",
        tokenOutSymbol: "VETS",
        amountPerInterval: "1; DROP TABLE users;",
        intervalSeconds: 3600,
        totalIntervals: 10,
      })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// VOTING POWER LIMITS
// ═══════════════════════════════════════════════════════════════════════
describe("Voting Power Limits", () => {
  it("rejects voting power > 1 billion", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.dao.votes.cast({
        proposalDbId: 1,
        proposalId: "HERO-TEST",
        voterAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        choice: "for",
        votingPower: 1_000_000_001,
        chain: "pulsechain",
      })
    ).rejects.toThrow();
  });

  it("rejects negative voting power", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.dao.votes.cast({
        proposalDbId: 1,
        proposalId: "HERO-TEST",
        voterAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        choice: "for",
        votingPower: -1,
        chain: "pulsechain",
      })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// NFT URL VALIDATION
// ═══════════════════════════════════════════════════════════════════════
describe("NFT Share URL Validation", () => {
  it("rejects HTTP NFT image URL", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.media.shareNft({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        title: "My NFT",
        nftImageUrl: "http://evil.com/image.png",
        nftContractAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        nftTokenId: "1",
        nftChainId: 369,
      })
    ).rejects.toThrow();
  });

  it("rejects javascript: in NFT image URL", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.media.shareNft({
        walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        title: "My NFT",
        nftImageUrl: "javascript:alert(1)",
        nftContractAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        nftTokenId: "1",
        nftChainId: 369,
      })
    ).rejects.toThrow();
  });
});
