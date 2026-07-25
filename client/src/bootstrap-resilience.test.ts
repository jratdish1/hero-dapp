import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isDappLoadFailure } from "./components/DappLoadBoundary";

const source = (relativePath: string) =>
  readFileSync(resolve(import.meta.dirname, relativePath), "utf8");

describe("public bootstrap resilience", () => {
  it("recognizes common stale dynamic-import failures", () => {
    expect(
      isDappLoadFailure(
        new Error("Failed to fetch dynamically imported module: /assets/DappBootstrap-old.js"),
      ),
    ).toBe(true);
    expect(isDappLoadFailure(new Error("ChunkLoadError: Loading chunk 42 failed"))).toBe(true);
    expect(isDappLoadFailure(new Error("ordinary render failure"))).toBe(false);
  });

  it("wraps the lazy DApp bootstrap in its external load boundary", () => {
    const main = source("main.tsx");
    expect(main).toContain("<DappLoadBoundary>");
    expect(main).toMatch(
      /<DappLoadBoundary>[\s\S]*<Suspense fallback=\{<DappLoader \/>\}>[\s\S]*<DappBootstrap \/>/,
    );
  });

  it("updates page metadata when client navigation returns to the landing app", () => {
    const landing = source("LandingApp.tsx");
    expect(landing).toContain('import { usePageSEO } from "./hooks/usePageSEO";');
    expect(landing).toContain("usePageSEO();");
  });
});
