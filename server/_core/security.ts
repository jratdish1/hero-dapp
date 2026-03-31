import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { Express, Request, Response, NextFunction } from "express";

/**
 * HERO Dapp — Server-Side Security Middleware
 * ============================================
 * Comprehensive rate limiting, HTTP security headers, request sanitization,
 * and Cloudflare proxy compatibility.
 *
 * Rate Limit Tiers:
 * ┌──────────────────────┬──────────┬───────────┬────────────────────────────┐
 * │ Route / Category     │ Max/min  │ Window    │ Reason                     │
 * ├──────────────────────┼──────────┼───────────┼────────────────────────────┤
 * │ Global fallback      │ 200      │ 1 min     │ Catch-all safety net       │
 * │ tRPC API (general)   │ 100      │ 1 min     │ Normal API usage           │
 * │ OAuth / Auth         │ 15       │ 1 min     │ Brute-force prevention     │
 * │ AI Chat (LLM)        │ 10       │ 1 min     │ Expensive LLM calls        │
 * │ Media Upload         │ 5        │ 1 min     │ S3 upload abuse prevention │
 * │ DAO Proposals        │ 10       │ 5 min     │ Spam proposal prevention   │
 * │ DAO Voting           │ 20       │ 1 min     │ Vote spam prevention       │
 * │ Price Feed           │ 60       │ 1 min     │ Cached, but limit scraping │
 * │ Wallet Operations    │ 30       │ 1 min     │ Moderate wallet actions     │
 * └──────────────────────┴──────────┴───────────┴────────────────────────────┘
 */

// ─── Helper: Extract real client IP (Cloudflare-aware) ──────────────────
function getClientIp(req: Request): string {
  return (
    (req.headers["cf-connecting-ip"] as string) ||
    (req.headers["x-real-ip"] as string) ||
    req.ip ||
    "unknown"
  );
}

// ─── Helper: Create rate limiter with consistent defaults ───────────────
function createLimiter(opts: {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: opts.message },
    validate: false,
    keyGenerator: getClientIp,
    skipSuccessfulRequests: opts.skipSuccessfulRequests ?? false,
    skipFailedRequests: opts.skipFailedRequests ?? false,
  });
}

// ─── Helmet: HTTP Security Headers (Cloudflare-compatible) ────────────
export function setupHelmet(app: Express) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: [
            "'self'", "data:", "blob:", "https:",
            "https://*.manus.computer", "https://*.manus.space",
          ],
          connectSrc: [
            "'self'",
            "https://rpc.pulsechain.com", "https://mainnet.base.org",
            "https://api.dexscreener.com",
            "wss://relay.walletconnect.com", "wss://relay.walletconnect.org",
            "https://*.walletconnect.com", "https://*.walletconnect.org",
            "https://*.reown.com",
            "https://*.manus.computer", "https://*.manus.space",
            "https://api.manus.im",
          ],
          frameSrc: [
            "'self'",
            "https://*.walletconnect.com", "https://*.walletconnect.org",
            "https://app.safe.global",
          ],
          mediaSrc: ["'self'", "https:", "blob:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'", "https://app.safe.global"],
          upgradeInsecureRequests: [],
        },
      },
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xContentTypeOptions: true,
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      xFrameOptions: false,
      xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
      xPoweredBy: false,
      xXssProtection: true,
    })
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RATE LIMITERS — Per-Route Granular Limits
// ═══════════════════════════════════════════════════════════════════════

// Global fallback: 200 req/min — catches anything not covered by specific limiters
export const globalLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: "Too many requests from this IP. Please slow down.",
});

// General tRPC API: 100 req/min
export const generalApiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: "Too many API requests. Please try again later.",
});

// OAuth / Authentication: 15 req/min (brute-force prevention)
export const authLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: "Too many authentication attempts. Please wait before trying again.",
  skipSuccessfulRequests: false,
});

// AI Chat (LLM calls): 10 req/min (expensive server-side calls)
export const aiChatLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: "AI rate limit reached. Please wait before sending more messages.",
});

// Media Upload: 5 req/min (S3 upload abuse prevention)
export const mediaUploadLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: "Upload limit reached. Please wait before uploading more files.",
});

// DAO Proposal Creation: 10 req/5min (spam proposal prevention)
export const daoProposalLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: "Proposal creation limit reached. Please wait before submitting more proposals.",
});

// DAO Voting: 20 req/min (vote spam prevention)
export const daoVoteLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "Voting rate limit reached. Please wait before casting more votes.",
});

// Price Feed / Market Data: 60 req/min (cached, but prevent scraping)
export const priceFeedLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Price data rate limit reached. Data refreshes every 30 seconds.",
});

// Wallet Operations: 30 req/min
export const walletLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many wallet requests. Please try again later.",
});

// ─── Request Sanitization ───────────────────────────────────────────────
export function sanitizeRequestBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: Record<string, unknown>) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "string") {
      obj[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitizeObject(value as Record<string, unknown>);
    }
  }
}

// ─── Cloudflare Security Headers ────────────────────────────────────────
export function cloudflareSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  );
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // No-cache for API responses to prevent stale data
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
}

// ─── Cloudflare Origin Validation ───────────────────────────────────────
export function validateCloudflareOrigin(req: Request, _res: Response, next: NextFunction) {
  const cfRay = req.headers["cf-ray"];
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  if (cfRay || cfConnectingIp) {
    return next();
  }
  // Allow non-CF traffic in dev; in production with CF mandatory, return 403 here
  next();
}

// ─── Request Size Guard ─────────────────────────────────────────────────
// Reject oversized payloads early (before body parsing for non-upload routes)
export function requestSizeGuard(maxBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > maxBytes) {
      res.status(413).json({ error: "Request payload too large." });
      return;
    }
    next();
  };
}

// ─── Suspicious Request Blocker ─────────────────────────────────────────
// Block common attack patterns (path traversal, SQL injection in URLs)
export function blockSuspiciousRequests(req: Request, res: Response, next: NextFunction) {
  const suspiciousPatterns = [
    /\.\.\//,                    // Path traversal
    /\/etc\/passwd/i,            // Linux file access
    /\/proc\/self/i,             // Proc filesystem
    /<script/i,                  // XSS in URL
    /union\s+select/i,          // SQL injection
    /;\s*drop\s+table/i,        // SQL injection
    /\bexec\s*\(/i,             // Command injection
    /\beval\s*\(/i,             // Code injection
    /0x[0-9a-f]{20,}/i,         // Hex-encoded payloads (not ETH addresses — those are 40 chars)
  ];

  const fullUrl = req.originalUrl || req.url;
  for (const pattern of suspiciousPatterns) {
    // Skip the hex pattern for legitimate blockchain addresses
    if (pattern.source.includes("0x") && fullUrl.includes("/api/trpc")) {
      continue;
    }
    if (pattern.test(fullUrl)) {
      console.warn(`[Security] Blocked suspicious request: ${req.method} ${fullUrl} from ${getClientIp(req)}`);
      res.status(400).json({ error: "Bad request." });
      return;
    }
  }
  next();
}

// ─── tRPC Route-Level Rate Limiting Middleware ───────────────────────────
// This middleware inspects the tRPC procedure path in the URL and applies
// the appropriate rate limiter based on the operation type.
export function trpcRouteLimiter(req: Request, res: Response, next: NextFunction) {
  const url = req.originalUrl || req.url;

  // AI Chat endpoints — strictest limit
  if (url.includes("assistant.chat") || url.includes("assistant.stream")) {
    return aiChatLimiter(req, res, next);
  }

  // Media upload endpoints
  if (url.includes("media.upload") || url.includes("media.create")) {
    return mediaUploadLimiter(req, res, next);
  }

  // DAO proposal creation
  if (url.includes("dao.createProposal") || url.includes("dao.create")) {
    return daoProposalLimiter(req, res, next);
  }

  // DAO voting
  if (url.includes("dao.vote") || url.includes("dao.castVote")) {
    return daoVoteLimiter(req, res, next);
  }

  // Price feed / market data
  if (url.includes("prices.") || url.includes("buyAndBurn") || url.includes("farmPools")) {
    return priceFeedLimiter(req, res, next);
  }

  // Default: general API limiter
  return generalApiLimiter(req, res, next);
}

// ═══════════════════════════════════════════════════════════════════════
// SETUP — Wire all middleware into the Express app
// ═══════════════════════════════════════════════════════════════════════
export function setupSecurity(app: Express) {
  // Trust proxy: Cloudflare / reverse proxy sits in front
  app.set("trust proxy", 1);

  // 1. Block suspicious requests early (before any processing)
  app.use(blockSuspiciousRequests);

  // 2. Global rate limit — safety net for all routes
  app.use(globalLimiter);

  // 3. HTTP security headers via Helmet (HSTS, CSP, etc.)
  setupHelmet(app);

  // 4. Cloudflare-compatible additional headers
  app.use(cloudflareSecurityHeaders);

  // 5. Cloudflare origin validation
  app.use(validateCloudflareOrigin);

  // 6. Per-route rate limiting for tRPC API
  app.use("/api/trpc", trpcRouteLimiter);

  // 7. Auth-specific rate limiting
  app.use("/api/oauth", authLimiter);

  // 8. Request body sanitization (XSS prevention)
  app.use(sanitizeRequestBody);

  // 9. Request size guard for non-upload API routes (1MB max)
  app.use("/api/trpc", requestSizeGuard(1 * 1024 * 1024));
}
