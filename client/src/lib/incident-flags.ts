/**
 * Incident kill-switch (2026-10-07, HERO signer compromise).
 *
 * The HeroCards owner key and the HeroABLE signer key (0x5F1D…7Dba) are
 * compromised. Until contract ownership is rotated or migrated, the frontend
 * must not start any wallet write, signature, or approval (staking, swaps,
 * mint, spin, DAO, rewards, wallet send/bridge). The single exception is
 * revoking allowances (approve(spender, 0) / setApprovalForAll(op, false)),
 * which only reduces exposure and therefore stays available.
 *
 * Default is ON (maintenance). Set VITE_HERO_INCIDENT_MAINTENANCE="false"
 * at build time only after the owner confirms rotation on-chain.
 */
export const HERO_INCIDENT_MAINTENANCE: boolean =
  (import.meta.env.VITE_HERO_INCIDENT_MAINTENANCE ?? "true") !== "false";

export const HERO_INCIDENT_MESSAGE =
  "Maintenance: staking, swaps, minting, Spin the Wheel, DAO voting and all other wallet transactions are paused while we rotate contract keys. " +
  "Revoking token approvals remains available. Your funds are not affected by viewing this site. Do not send funds to any HERO contract or wallet address until this notice is removed.";

export const HERO_INCIDENT_WRITE_BLOCKED_ERROR =
  "Wallet transactions and signatures are paused for maintenance";

/** Throws while maintenance is on. Call before any wallet write, sign, or approve. */
export function assertWalletWritesAllowed(): void {
  if (HERO_INCIDENT_MAINTENANCE) {
    throw new Error(HERO_INCIDENT_WRITE_BLOCKED_ERROR);
  }
}

export const HERO_INCIDENT_REVOKE_NOTE =
  "Revoking token approvals stays available during maintenance. Only revokes are allowed: new or increased approvals are paused.";

export const HERO_INCIDENT_REVOKE_URL = "https://revoke.cash";

export type IncidentApprovalWrite =
  | { kind: "approve"; amount: bigint }
  | { kind: "setApprovalForAll"; approved: boolean };

/** True only for writes that remove an allowance: approve(spender, 0) or setApprovalForAll(op, false). */
export function isRevokeWrite(write: IncidentApprovalWrite): boolean {
  return write.kind === "approve" ? write.amount === 0n : write.approved === false;
}

/**
 * Throws while maintenance is on unless the write is a revoke. Call before any
 * approve / setApprovalForAll. `maintenance` is injectable for tests only.
 */
export function assertApprovalWriteAllowed(
  write: IncidentApprovalWrite,
  maintenance: boolean = HERO_INCIDENT_MAINTENANCE,
): void {
  if (maintenance && !isRevokeWrite(write)) {
    throw new Error(HERO_INCIDENT_WRITE_BLOCKED_ERROR);
  }
}
