import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { Express, Request, Response, NextFunction } from "express";

/**
 * Security middleware for the HERO Dapp.
 * Adds HTTP security headers, rate limiting, and request sanitization.
 */

// ─── Helmet: HTTP Security Headers ─────────────────────────────────────
export function setupHelmet(app: Express) {
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite dev server needs inline scripts
      crossOriginEmbedderPolicy: false, // Allow embedding external images (token logos, CDN)
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
}

// ─── Rate Limiting ──────────────────────────────────────────────────────

// General API rate limit: 100 requests per minute per IP
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
  validate: false,
});

// AI chat rate limit: 10 requests per minute per IP (LLM calls are expensive)
export const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit reached. Please wait before sending more messages." },
  validate: false,
});

// Auth rate limit: 20 requests per minute per IP
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
  validate: false,
});

// ─── Request Sanitization ───────────────────────────────────────────────

/**
 * Sanitize request body to prevent basic XSS in stored data.
 * Strips script tags and event handlers from string values.
 */
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
      // Strip script tags and event handlers but preserve markdown
      obj[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitizeObject(value as Record<string, unknown>);
    }
  }
}

// ─── Security Headers for API Responses ─────────────────────────────────
export function apiSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

// ─── Setup All Security Middleware ──────────────────────────────────────
export function setupSecurity(app: Express) {
  // Trust proxy for rate limiting behind reverse proxy
  app.set("trust proxy", 1);

  // HTTP security headers
  setupHelmet(app);

  // API security headers
  app.use("/api", apiSecurityHeaders);

  // Rate limiting
  app.use("/api/trpc", generalApiLimiter);
  app.use("/api/oauth", authLimiter);

  // Request body sanitization
  app.use(sanitizeRequestBody);
}
