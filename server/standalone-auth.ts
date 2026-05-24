import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// Security: Fail fast if JWT_SECRET is not set or is the insecure default
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === "hero-dapp-jwt-secret-key-2026" || JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[FATAL] JWT_SECRET must be set to a strong secret (32+ chars) in production");
  }
  console.warn("[standalone-auth] WARNING: JWT_SECRET is weak or missing. Set a strong secret for production.");
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || "dev-only-insecure-secret-do-not-use-in-prod";

const ADMIN_PASSWORD = process.env.HERO_ADMIN_PASSWORD || "";
const COOKIE_NAME = "hero-session";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Rate limiting: track failed login attempts per IP
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes lockout after max attempts

function isRateLimited(ip: string): boolean {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  const elapsed = Date.now() - record.firstAttempt;
  // Reset window if expired
  if (elapsed > LOCKOUT_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const record = loginAttempts.get(ip);
  if (!record || (Date.now() - record.firstAttempt > WINDOW_MS)) {
    loginAttempts.set(ip, { count: 1, firstAttempt: Date.now() });
  } else {
    record.count++;
  }
}

function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// Timing-safe password comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant-ish time
    crypto.timingSafeEqual(Buffer.from(a.padEnd(64, '\0')), Buffer.from(b.padEnd(64, '\0')));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function registerStandaloneAuth(app: Express) {
  // Login endpoint with rate limiting
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";

      // Rate limiting check
      if (isRateLimited(clientIp)) {
        return res.status(429).json({
          success: false,
          error: "Too many login attempts. Please try again later.",
        });
      }

      const { password } = req.body;

      if (!ADMIN_PASSWORD) {
        return res.status(500).json({ success: false, error: "Admin password not configured" });
      }

      if (!password || typeof password !== "string") {
        recordFailedAttempt(clientIp);
        return res.status(401).json({ success: false, error: "Invalid password" });
      }

      if (!safeCompare(password, ADMIN_PASSWORD)) {
        recordFailedAttempt(clientIp);
        return res.status(401).json({ success: false, error: "Invalid password" });
      }

      // Successful login — clear rate limit record
      clearAttempts(clientIp);

      // Issue JWT
      const token = jwt.sign(
        { sub: "admin", role: "operator", iat: Math.floor(Date.now() / 1000) },
        EFFECTIVE_JWT_SECRET,
        { expiresIn: "365d" }
      );

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", // Upgraded from "lax" to "strict" for CSRF protection
        maxAge: ONE_YEAR_MS,
        path: "/",
      });

      return res.json({ success: true });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ success: false, error: "Internal error" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.json({ success: true });
  });

  // Session check endpoint
  app.get("/api/auth/me", (req: Request, res: Response) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ authenticated: false });
    }
    try {
      const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
      return res.json({ authenticated: true, user: decoded });
    } catch {
      return res.status(401).json({ authenticated: false });
    }
  });

  console.log("[standalone-auth] Password auth endpoints registered (rate-limited): /api/auth/login, /api/auth/logout, /api/auth/me");
}
