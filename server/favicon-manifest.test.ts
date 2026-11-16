import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";

const pub = "client/public";
const indexHtml = readFileSync("client/index.html", "utf8");

describe("favicon set and web manifest (SEO desk 2026-11-16)", () => {
  it("links every favicon size, apple-touch icon and the manifest", () => {
    for (const href of ["/favicon.ico", "/favicon-96x96.png", "/favicon.svg", "/apple-touch-icon.png", "/site.webmanifest"]) {
      expect(indexHtml).toContain(`href="${href}"`);
      expect(existsSync(`${pub}${href}`)).toBe(true);
      expect(statSync(`${pub}${href}`).size).toBeGreaterThan(100);
    }
    expect(indexHtml).not.toContain('rel="icon" type="image/webp"');
  });

  it("ships a valid manifest whose icons exist", () => {
    const m = JSON.parse(readFileSync(`${pub}/site.webmanifest`, "utf8"));
    expect(m.name).toBe("HERO Dapp");
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const i of m.icons) expect(existsSync(`${pub}${i.src}`)).toBe(true);
  });

  it("uses a real 1200x630 social image on herobase.io", () => {
    expect(indexHtml).toContain('content="https://herobase.io/og-image-1200x630.jpg"');
    expect(existsSync(`${pub}/og-image-1200x630.jpg`)).toBe(true);
  });
});
