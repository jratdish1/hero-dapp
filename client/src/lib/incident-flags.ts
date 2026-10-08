/**
 * Incident kill-switch (2026-10-07, HERO signer compromise).
 *
 * The HeroCards owner key and the HeroABLE signer key (0x5F1D…7Dba) are
 * compromised. Until contract ownership is rotated or migrated, the frontend
 * must not start any wallet write, signature, or approval (staking, swaps,
 * mint, spin, DAO, rewards, wallet send/bridge).
 *
 * Default is ON (maintenance). Set VITE_HERO_INCIDENT_MAINTENANCE="false"
 * at build time only after the owner confirms rotation on-chain.
 */
export const HERO_INCIDENT_MAINTENANCE: boolean =
  (import.meta.env.VITE_HERO_INCIDENT_MAINTENANCE ?? "true") !== "false";

export const HERO_INCIDENT_MESSAGE =
  "Maintenance: staking, swaps, minting, Spin the Wheel, DAO voting and all other wallet transactions are paused while we rotate contract keys. " +
  "Your funds are not affected by viewing this site. Do not send funds to any HERO contract or wallet address until this notice is removed.";

export const HERO_INCIDENT_WRITE_BLOCKED_ERROR =
  "Wallet transactions and signatures are paused for maintenance";

/** Throws while maintenance is on. Call before any wallet write, sign, or approve. */
export function assertWalletWritesAllowed(): void {
  if (HERO_INCIDENT_MAINTENANCE) {
    throw new Error(HERO_INCIDENT_WRITE_BLOCKED_ERROR);
  }
}
