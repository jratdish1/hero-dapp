/**
 * Security containment — HERO front end (incident 2026-10, queue row 216).
 *
 * Authority: VETS GO 2026-10-22 23:25 UTC for HERO front-end containment.
 *
 * WHY: the HeroCards NFT contracts on Base and PulseChain are owned by a
 * deployer key that is in attacker hands (EIP-7702 sweeper on Base). Any mint
 * revenue or royalty would reach the attacker. The SSS staking owner/treasury
 * is unverified. Until contracts are redeployed under a Safe, the site must not
 * route user funds to any of these addresses.
 *
 * HOW TO RE-ENABLE (only after the redeploy, via a reviewed PR):
 *   1. Point heroCards-config.ts at the NEW Safe-owned contract addresses.
 *   2. Flip HERO_CARDS_MINT_ENABLED to true below.
 *   The compromised addresses stay blocked by isBlockedContract() even if the
 *   flag is flipped, so the old contracts can never be minted from this UI.
 *
 * This is a code constant on purpose (not a VITE_ env var): an env var on the
 * build host could silently re-enable minting without review.
 */

/** Single switch for HeroCards public/whitelist mint UI + tx path. Default: PAUSED. */
export const HERO_CARDS_MINT_ENABLED = false as boolean;

/**
 * Single switch for NEW deposits into the SSS staking contract (owner/treasury
 * unverified). Unstake, emergency withdraw and reward claims stay available.
 */
export const HERO_STAKE_NEW_DEPOSITS_ENABLED = false as boolean;

export const MINT_PAUSED_MESSAGE = "Minting paused for security";
export const MINT_PAUSED_DETAIL =
  "HERO Cards minting is paused: contracts under migration. Do not send funds.";
export const STAKE_PAUSED_MESSAGE = "New stakes paused for security";
export const STAKE_PAUSED_DETAIL =
  "New HERO stakes are paused while the staking contract is migrated. Existing stakers can still unstake, emergency-withdraw and claim.";
export const SECURITY_NOTICE_TITLE = "Security notice";
export const SECURITY_NOTICE_TEXT =
  "Do not send funds, tokens or NFTs to these addresses. HERO Cards minting is paused while contracts migrate.";
export const SECURITY_NOTICE_DEFANG_NOTE =
  "Addresses are shortened on purpose so they cannot be copied into a wallet.";
export const SECURITY_NOTICE_DISMISS = "Hide for this session";

export type DoNotFundStatus = "COMPROMISED" | "MALICIOUS" | "ATTACKER" | "UNVERIFIED";

export interface DoNotFundEntry {
  /** Display-only, defanged form. The full address is never shipped in the notice. */
  display: string;
  status: DoNotFundStatus;
  label: string;
  chain: string;
}

/**
 * Defang an address: keep first 6 and last 4 chars, replace the middle with a
 * status tag. The result is not a valid address and cannot be pasted into a
 * wallet. Exported for tests.
 */
export function defangAddress(address: string, status: DoNotFundStatus): string {
  return `${address.slice(0, 6)}…[${status}]…${address.slice(-4)}`;
}

/**
 * The do-not-fund list (defanged literals; source: card 216 + HERO dapp
 * readiness report §0). Literals are kept pre-defanged so the full addresses
 * never enter the client bundle through this list.
 */
export const DO_NOT_FUND_LIST: readonly DoNotFundEntry[] = [
  { display: "0x5F1D…[COMPROMISED]…7Dba", status: "COMPROMISED", label: "HERO deployer key (stolen)", chain: "Base + PulseChain" },
  { display: "0xdf02…[MALICIOUS]…8792", status: "MALICIOUS", label: "Sweeper contract", chain: "Base" },
  { display: "0x2dCD…[ATTACKER]…dEC8", status: "ATTACKER", label: "Attacker wallet", chain: "Base" },
  { display: "0x5Fad…[COMPROMISED]…97bE", status: "COMPROMISED", label: "HeroCards NFT contract (admin compromised)", chain: "Base" },
  { display: "0xCe60…[COMPROMISED]…7B36", status: "COMPROMISED", label: "HeroCards NFT contract (admin compromised)", chain: "PulseChain" },
  { display: "0xeb2C…[UNVERIFIED]…24e6", status: "UNVERIFIED", label: "Staking owner / treasury: do not send funds until ownership is re-verified", chain: "Base + PulseChain" },
] as const;

/**
 * Lower-case prefixes/suffixes of contracts the UI must never send a write to.
 * Prefix+suffix match (no full literal) keeps full addresses out of this list.
 */
const BLOCKED_CONTRACTS: ReadonlyArray<readonly [string, string]> = [
  ["0x5fad09", "71897be"], // HeroCards Base
  ["0xce609b", "f7b36"], // HeroCards PulseChain
  ["0x5f1d1a", "f4e7dba"], // compromised deployer
  ["0xdf02e0", "c698792"], // sweeper
  ["0x2dcdea", "e9bdec8"], // attacker
];

export function isBlockedContract(address: string | undefined | null): boolean {
  if (!address) return false;
  const a = address.toLowerCase();
  return BLOCKED_CONTRACTS.some(([p, s]) => a.startsWith(p) && a.endsWith(s));
}

const SESSION_KEY = "hero-security-notice-dismissed-20261022";
export function isNoticeDismissedForSession(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
export function dismissNoticeForSession(): void {
  try {
    if (typeof window !== "undefined") window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}
