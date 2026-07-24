import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function safeCompare(candidate: string, expected: string): boolean {
  const candidateDigest = crypto.createHash("sha256").update(candidate).digest();
  const expectedDigest = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(candidateDigest, expectedDigest);
}

function rotateCsrfToken(res: Response): void {
  res.cookie("csrf_token", crypto.randomBytes(32).toString("hex"), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export function registerStandaloneAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const password: unknown = req.body?.password;
      if (typeof password !== "string" || password.length === 0) {
        res.status(400).json({ error: "Password required" });
        return;
      }

      const adminPassword = process.env.HERO_ADMIN_PASSWORD;
      if (!adminPassword || adminPassword.length < 16) {
        console.error("[Auth] HERO_ADMIN_PASSWORD is missing or does not meet the minimum length");
        res.status(503).json({ error: "Authentication is temporarily unavailable" });
        return;
      }

      if (!safeCompare(password, adminPassword)) {
        res.status(401).json({ error: "Invalid password" });
        return;
      }

      const ownerOpenId = process.env.OWNER_OPEN_ID || "standalone-admin";
      const ownerName = process.env.OWNER_NAME || "VETS";
      await db.upsertUser({
        openId: ownerOpenId,
        name: ownerName,
        email: null,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(ownerOpenId, {
        name: ownerName,
        expiresInMs: SESSION_MAX_AGE_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: SESSION_MAX_AGE_MS,
      });
      rotateCsrfToken(res);
      res.json({ success: true, user: { name: ownerName } });
    } catch (error) {
      console.error("[Auth] Login failed:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: "Login failed" });
    }
  });
}
