/**
 * Queue row 216 — HERO front-end containment tests.
 * Full addresses below exist ONLY in this test file (never shipped to the
 * client bundle); they are used to prove the defanged notice entries match.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HERO_CARDS_MINT_ENABLED,
  HERO_STAKE_NEW_DEPOSITS_ENABLED,
  DO_NOT_FUND_LIST,
  defangAddress,
  isBlockedContract,
  SECURITY_NOTICE_TEXT,
  SECURITY_NOTICE_TITLE,
  SECURITY_NOTICE_DEFANG_NOTE,
  SECURITY_NOTICE_DISMISS,
  MINT_PAUSED_MESSAGE,
  MINT_PAUSED_DETAIL,
  STAKE_PAUSED_MESSAGE,
  STAKE_PAUSED_DETAIL,
} from "./securityContainment";
import { HERO_CARDS_ADDRESS_BASE, HERO_CARDS_ADDRESS_PULSECHAIN } from "./heroCards-config";
import { translations } from "../contexts/LanguageContext";
import SecurityNotice from "../components/SecurityNotice";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

// Card 216 list (full form, test-only)
const CARD_216 = [
  ["0x5F1D1af1EbA90FD4A29e194275c6DfA42f4E7Dba", "COMPROMISED"],
  ["0xdf02e0aa8a707f2b190b355f320CE7d3Bc698792", "MALICIOUS"],
  ["0x2dCDEA8a708f1FdeCa5E2E59D4cb70bD2E9BdEC8", "ATTACKER"],
  ["0x5Fad096af059ff9A2167351A0ffc8b45D71897bE", "COMPROMISED"],
  ["0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36", "COMPROMISED"],
  ["0xeb2C36C1804A8D4c68a2033dEe5ACc1294bD24e6", "UNVERIFIED"],
] as const;

describe("row 216: mint paused by default on both chains", () => {
  it("flags default to paused", () => {
    expect(HERO_CARDS_MINT_ENABLED).toBe(false);
    expect(HERO_STAKE_NEW_DEPOSITS_ENABLED).toBe(false);
  });

  it("both HeroCards contracts (Base 8453 + PulseChain 369) are blocked even if the flag is flipped", () => {
    expect(isBlockedContract(HERO_CARDS_ADDRESS_BASE)).toBe(true);
    expect(isBlockedContract(HERO_CARDS_ADDRESS_PULSECHAIN)).toBe(true);
    expect(isBlockedContract(HERO_CARDS_ADDRESS_BASE.toLowerCase())).toBe(true);
    expect(isBlockedContract("0x0000000000000000000000000000000000000001")).toBe(false);
    expect(isBlockedContract(undefined)).toBe(false);
  });

  it("useHeroCards gates every writeContract call behind the flag and exposes mintPaused", () => {
    const src = read("lib/useHeroCards.ts");
    expect(src).toContain("const mintAllowed = HERO_CARDS_MINT_ENABLED && !isBlockedContract(contractAddress)");
    expect(src).toMatch(/const mint: \(quantity: number\) => void = HERO_CARDS_MINT_ENABLED\s*\?/);
    expect(src).toMatch(/const whitelistMint: [^=]+=> void = HERO_CARDS_MINT_ENABLED\s*\?/);
    expect(src).toContain("const canMint = mintAllowed &&");
    expect(src).toContain("mintPaused: !mintAllowed");
    // writeContract appears exactly twice, both inside the flag-gated branches
    expect(src.match(/writeContract\(\{/g)?.length).toBe(2);
  });

  it("NFTMint renders the paused panel and disables the button when paused", () => {
    const src = read("pages/NFTMint.tsx");
    expect(src).toContain("mintPaused ? (");
    expect(src).toContain('data-testid="mint-paused-button"');
    expect(src).toContain("if (mintPaused || !canMint) return;");
  });
});

describe("row 216: staking banner removed", () => {
  it("HeroStake has no 0xeb2C36 address and no 735 DAI funding instruction", () => {
    const src = read("pages/HeroStake.tsx");
    expect(src.toLowerCase()).not.toContain("0xeb2c36");
    expect(src).not.toMatch(/735\s*DAI/);
    expect(src).not.toContain("fund the contract owner wallet");
  });

  it("HeroStake keeps unstake / emergency withdraw / claim, and blocks new stakes", () => {
    const src = read("pages/HeroStake.tsx");
    expect(src).toContain("actions.unstake(");
    expect(src).toContain("actions.emergencyWithdraw()");
    expect(src).toContain("actions.claimRewards()");
    expect(src).toContain("if (newStakesPaused) {");
  });

  it("no client source outside tests contains a full card-216 address", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.(tsx?|jsx?)$/.test(f.name) && !/\.test\./.test(f.name) && !/\.bak/.test(f.name)) {
          const s = fs.readFileSync(p, "utf8").toLowerCase();
          // HeroCards addresses stay in heroCards-config.ts for read-only calls (blocked for writes)
          for (const [a] of CARD_216) {
            if (s.includes(a.toLowerCase()) && !p.endsWith("heroCards-config.ts")) hits.push(`${path.relative(SRC, p)}:${a.slice(0, 8)}`);
          }
        }
      }
    };
    walk(SRC);
    expect(hits).toEqual([]);
  });
});

describe("row 216: site-wide DO-NOT-FUND notice", () => {
  it("lists exactly the 6 card-216 addresses, defanged", () => {
    expect(DO_NOT_FUND_LIST.length).toBe(6);
    CARD_216.forEach(([addr, status], i) => {
      expect(DO_NOT_FUND_LIST[i].display).toBe(defangAddress(addr, status));
      expect(DO_NOT_FUND_LIST[i].status).toBe(status);
    });
  });

  it("defanged entries are not valid addresses and cannot be pasted into a wallet", () => {
    for (const e of DO_NOT_FUND_LIST) {
      expect(e.display).not.toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(e.display).toMatch(/\[(COMPROMISED|MALICIOUS|ATTACKER|UNVERIFIED)\]/);
    }
  });

  it("renders title, text and all 6 entries (chain-independent markup)", () => {
    const html = renderToStaticMarkup(React.createElement(SecurityNotice));
    expect(html).toContain('data-testid="security-notice"');
    expect(html).toContain(SECURITY_NOTICE_TITLE);
    expect(html).toContain(SECURITY_NOTICE_TEXT);
    for (const e of DO_NOT_FUND_LIST) expect(html).toContain(e.display);
    for (const [a] of CARD_216) expect(html.toLowerCase()).not.toContain(a.toLowerCase());
  });

  it("is mounted on the public landing page (/) too", () => {
    const src = read("LandingApp.tsx");
    expect(src).toContain("<SecurityNotice />");
    expect(src.indexOf("<SecurityNotice />")).toBeLessThan(src.indexOf("<Home />"));
  });

  it("is mounted in App above the router (every route)", () => {
    const src = read("App.tsx");
    const notice = src.indexOf("<SecurityNotice />");
    const router = src.indexOf("<Router />");
    expect(notice).toBeGreaterThan(-1);
    expect(router).toBeGreaterThan(notice);
  });

  it("has en (source) + es/fr/de translations for every new string", () => {
    const keys = [
      SECURITY_NOTICE_TITLE, SECURITY_NOTICE_TEXT, SECURITY_NOTICE_DEFANG_NOTE, SECURITY_NOTICE_DISMISS,
      MINT_PAUSED_MESSAGE, MINT_PAUSED_DETAIL, STAKE_PAUSED_MESSAGE, STAKE_PAUSED_DETAIL, "MINT PAUSED",
      ...DO_NOT_FUND_LIST.map((e) => e.label),
    ];
    for (const lang of ["es", "fr", "de"] as const) {
      for (const k of keys) {
        expect(translations[lang][k], `${lang}: ${k}`).toBeTruthy();
        expect(translations[lang][k]).not.toBe(k);
      }
    }
  });
});

describe("row 216: ComponentShowcase not publicly routed", () => {
  it("App.tsx has no ComponentShowcase route", () => {
    expect(read("App.tsx")).not.toContain("ComponentShowcase");
  });
});
