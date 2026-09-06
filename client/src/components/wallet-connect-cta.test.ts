import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression for #93: Connect Wallet UI must use wagmi wallet connect,
 * not admin auth getLoginUrl() → /login.
 */
describe("wallet connect CTA does not route to admin login", () => {
  const root = resolve(import.meta.dirname ?? __dirname);

  function read(rel: string): string {
    return readFileSync(resolve(root, rel), "utf8");
  }

  it("WalletButton does not import getLoginUrl or link to /login", () => {
    const src = read("WalletButton.tsx");
    expect(src).not.toMatch(/getLoginUrl/);
    expect(src).not.toMatch(/from ["']@\/const["']/);
    expect(src).toMatch(/useConnect/);
    expect(src).toMatch(/Connect Wallet/);
    expect(src).not.toMatch(/href=\{getLoginUrl\(\)\}/);
    expect(src).not.toMatch(/<Link[^>]*href=["']\/login["']/);
  });

  it("ConnectWalletPrompt uses WalletButton, not getLoginUrl", () => {
    const src = read("ConnectWalletPrompt.tsx");
    expect(src).not.toMatch(/getLoginUrl/);
    expect(src).not.toMatch(/from ["']@\/const["']/);
    expect(src).toMatch(/WalletButton/);
    expect(src).not.toMatch(/href=\{getLoginUrl\(\)\}/);
    expect(src).not.toMatch(/<Link[^>]*href=["']\/login["']/);
  });
});
