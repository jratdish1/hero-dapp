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

  it("App restores /wallet to HeroWallet instead of redirecting to /portfolio", () => {
    const src = read("../App.tsx");
    expect(src).toMatch(/const HeroWallet = React\.lazy\(\(\) => import\("\.\/pages\/HeroWallet"\)\);/);
    expect(src).toMatch(/<Route path="\/wallet" component=\{withLayout\(HeroWallet\)\} \/>/);
    expect(src).not.toMatch(/<Route path="\/wallet"><Redirect to="\/portfolio" \/><\/Route>/);
  });

  it("HeroWallet disconnected state includes WalletButton", () => {
    const src = read("../pages/HeroWallet.tsx");
    expect(src).toMatch(/import \{ WalletButton \} from "@\/components\/WalletButton";/);
    expect(src).toMatch(/Connect your wallet to access full features/);
    expect(src).toMatch(/<WalletButton \/>/);
  });

  it("HeroWallet send validation checks the selected chain balance", () => {
    const src = read("../pages/HeroWallet.tsx");
    expect(src).toMatch(/validateSendRequest/);
  });
});
