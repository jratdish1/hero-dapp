import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "hero-dapp-jwt-secret-key-2026";
const ADMIN_PASSWORD = process.env.HERO_ADMIN_PASSWORD || "";
const COOKIE_NAME = "hero-session";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function registerStandaloneAuth(app: Express) {
  // Login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      
      if (!ADMIN_PASSWORD) {
        return res.status(500).json({ success: false, error: "Admin password not configured" });
      }
      
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: "Invalid password" });
      }
      
      // Issue JWT
      const token = jwt.sign(
        { sub: "admin", role: "operator", iat: Math.floor(Date.now() / 1000) },
        JWT_SECRET,
        { expiresIn: "365d" }
      );
      
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
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
      const decoded = jwt.verify(token, JWT_SECRET);
      return res.json({ authenticated: true, user: decoded });
    } catch {
      return res.status(401).json({ authenticated: false });
    }
  });

  console.log("[standalone-auth] Password auth endpoints registered: /api/auth/login, /api/auth/logout, /api/auth/me");
}
