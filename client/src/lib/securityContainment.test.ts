/**
 * Queue row 216 — HERO front-end containment tests.
 * No full compromised address is committed here: entries carry head/tail +
 * sha256 only, so the address-denylist CI gate stays green.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
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

// Card 216 list. No full address is committed (denylist CI gate): each entry
// keeps the real first-6 / last-4 characters (all that defangAddress() uses)
// plus the sha256 of the lowercase full address, used to scan sources.
const CARD_216 = [
  { head: "0x5F1D", tail: "7Dba", sha256: "b18b68a9de879fdbc23550cc514af1ed8ffc964ad64d1d958823ef90ab788aca", status: "COMPROMISED" },
  { head: "0xdf02", tail: "8792", sha256: "3db417834fbd884ea41d5dff6328700edf5164f20091038b6a9e79769fa9408e", status: "MALICIOUS" },
  { head: "0x2dCD", tail: "dEC8", sha256: "762e31f91af54ce7e94610c97ce5149713648e0c87f3fd1815cebec9324340d1", status: "ATTACKER" },
  { head: "0x5Fad", tail: "97bE", sha256: "1f3aa24dd3b35364d04ccf6b8523404ab52e2ed117426045af4d3239bec2beb1", status: "COMPROMISED" },
  { head: "0xCe60", tail: "7B36", sha256: "914aed1d82ba08b87e2a72ca29d9573eb5c9e382a83eded1dbe91db2e587254b", status: "COMPROMISED" },
  { head: "0xeb2C", tail: "24e6", sha256: "e0ae902184d50100f1b5788ef1e418ff657f3c852f7292095eefa33cb267e832", status: "UNVERIFIED" },
] as const;
// Synthetic stand-in (NOT the real address): same head/tail, zero middle.
const synth = (e: (typeof CARD_216)[number]) => `${e.head}${"0".repeat(32)}${e.tail}`;
const sha256 = (s: string) => createHash("sha256").update(s.toLowerCase()).digest("hex");
const CARD_216_HASHES = new Set(CARD_216.map((e) => e.sha256));
const ADDR_RE = /0x[0-9a-fA-F]{40}/g;

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
          for (const a of s.match(ADDR_RE) ?? []) {
            if (CARD_216_HASHES.has(sha256(a)) && !p.endsWith("heroCards-config.ts")) hits.push(`${path.relative(SRC, p)}:${a.slice(0, 8)}`);
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
    CARD_216.forEach((e, i) => {
      expect(DO_NOT_FUND_LIST[i].display).toBe(defangAddress(synth(e), e.status));
      expect(DO_NOT_FUND_LIST[i].status).toBe(e.status);
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
    for (const a of html.match(ADDR_RE) ?? []) expect(CARD_216_HASHES.has(sha256(a))).toBe(false);
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

describe("row 216 red-team hardening (2026-10-23)", () => {
  it("useStakingActions refuses approve + stake at the hook level while new deposits are paused", () => {
    const src = read("hooks/useStaking.ts");
    expect(src.match(/if \(!HERO_STAKE_NEW_DEPOSITS_ENABLED\) throw new Error\(STAKE_PAUSED_DETAIL\);/g)?.length).toBe(2);
    const unstake = src.slice(src.indexOf("const unstake = async"), src.indexOf("return {", src.indexOf("const emergencyWithdraw")));
    expect(unstake).not.toContain("HERO_STAKE_NEW_DEPOSITS_ENABLED");
  });

  it("NftCollection hides the embedded secondary marketplace while HeroCards are paused", () => {
    const src = read("pages/NftCollection.tsx");
    expect(src).toContain("{!HERO_CARDS_MINT_ENABLED ? (");
    expect(src).toContain('data-testid="marketplace-paused"');
    expect(src.indexOf('data-testid="marketplace-paused"')).toBeLessThan(src.indexOf("<iframe"));
  });

  it("notice dismissal is session-scoped only (no localStorage / cookie persistence)", () => {
    const src = read("lib/securityContainment.ts");
    expect(src).toContain("window.sessionStorage.setItem(");
    expect(src).not.toMatch(/localStorage|document\.cookie/);
    expect(read("components/SecurityNotice.tsx")).not.toMatch(/localStorage|document\.cookie/);
  });
});

describe("row 216: ComponentShowcase not publicly routed", () => {
  it("App.tsx has no ComponentShowcase route", () => {
    expect(read("App.tsx")).not.toContain("ComponentShowcase");
  });
});
