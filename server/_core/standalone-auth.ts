import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import crypto from "crypto";

// Simple constant-time comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

export function registerStandaloneAuthRoutes(app: Express) {
  // Password login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        res.status(400).json({ error: "Password required" });
        return;
      }

      // Get the admin password from environment
      const adminPassword = process.env.HERO_ADMIN_PASSWORD;
      if (!adminPassword) {
        console.error("[Auth] HERO_ADMIN_PASSWORD not set in environment");
        res.status(500).json({ error: "Auth not configured" });
        return;
      }

      // Verify password with constant-time comparison
      if (!safeCompare(password, adminPassword)) {
        // Rate limit: add small delay on failed attempts
        await new Promise(resolve => setTimeout(resolve, 1000));
        res.status(401).json({ error: "Invalid password" });
        return;
      }

      // Use the owner's openId from environment (or default)
      const ownerOpenId = process.env.OWNER_OPEN_ID || "standalone-admin";
      const ownerName = process.env.OWNER_NAME || "VETS";

      // Upsert the admin user
      await db.upsertUser({
        openId: ownerOpenId,
        name: ownerName,
        email: null,
        loginMethod: "password",
        lastSignedIn: new Date(),
      });

      // Create JWT session token (reuses existing SDK signing)
      const sessionToken = await sdk.createSessionToken(ownerOpenId, {
        name: ownerName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { name: ownerName } });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Keep the OAuth callback as fallback (if Manus OAuth is still configured)
  // This allows gradual migration
}
