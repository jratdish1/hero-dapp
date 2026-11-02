import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Request, Response, NextFunction } from "express";
import { csrfOriginValidation } from "./_core/security";

// SECURITY (2026-10-07 incident): Manus origins/hosts must not be trusted by CSRF or CSP.
function mockReq(origin: string): Request {
  return { method: "POST", headers: { origin }, body: {}, originalUrl: "/", url: "/", path: "/", protocol: "https", ip: "127.0.0.1" } as unknown as Request;
}
function mockRes(): Response {
  return { status() { return this; }, json() { return this; }, setHeader() {} } as unknown as Response;
}

describe("Manus trust removed (incident 2026-10-07)", () => {
  it("CSRF blocks POST from Manus origins in production", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      for (const origin of ["https://herodapp-kcdtjud9.manus.space", "https://evil.manus.space", "https://x.manus.computer"]) {
        let called = false;
        const next = (() => { called = true; }) as NextFunction;
        csrfOriginValidation(mockReq(origin), mockRes(), next);
        expect(called).toBe(false);
      }
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  it("CSRF still allows herobase.io", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      let called = false;
      csrfOriginValidation(mockReq("https://www.herobase.io"), mockRes(), (() => { called = true; }) as NextFunction);
      expect(called).toBe(true);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  it("security config has no Manus hosts outside comments", () => {
    const src = fs.readFileSync(path.join(__dirname, "_core", "security.ts"), "utf8");
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(code).not.toMatch(/manus\.(space|computer|im)/);
  });
});
