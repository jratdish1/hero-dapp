/**
 * Incident kill-switch (2026-10-07, HERO signer compromise).
 *
 * The HeroCards owner key and the HeroABLE signer key (0x5F1D…7Dba) are
 * compromised. Until contract ownership is rotated or migrated, the frontend
 * must not start any wallet write, signature, or approval (new stakes, swaps,
 * mint, spin, DAO, rewards, wallet send/bridge). Exits stay open, because users
 * must be able to leave a contract whose owner key is compromised: the
 * penalty-free exit (claimReward then emergencyWithdraw) at any time, and a
 * plain withdraw only once isLocked is false (before that the live contracts
 * pay 10% to treasury(); see lib/stakingExit.ts). Allowance revokes are
 * directed to revoke.cash: the in-app approvals list is not wallet-backed, so
 * it must not claim to revoke anything.
 *
 * Default is ON (maintenance). Set VITE_HERO_INCIDENT_MAINTENANCE="false"
 * at build time only after the owner confirms rotation on-chain.
 */
export const HERO_INCIDENT_MAINTENANCE: boolean =
  (import.meta.env.VITE_HERO_INCIDENT_MAINTENANCE ?? "true") !== "false";

export const HERO_INCIDENT_MESSAGE =
  "Maintenance: new stakes, swaps, minting, Spin the Wheel, DAO voting and all other wallet transactions are paused while we rotate contract keys. " +
  "Existing stakers can still leave with \"Withdraw without penalty\" (claims DAI, then returns all staked HERO); a plain unstake opens after the 7-day lock. Revoke token approvals directly at revoke.cash. " +
  "Your funds are not affected by viewing this site. Do not send funds to any HERO contract or wallet address until this notice is removed.";

export const HERO_INCIDENT_WRITE_BLOCKED_ERROR =
  "Wallet transactions and signatures are paused for maintenance";

/** Throws while maintenance is on. Call before any wallet write, sign, or approve. */
export function assertWalletWritesAllowed(): void {
  if (HERO_INCIDENT_MAINTENANCE) {
    throw new Error(HERO_INCIDENT_WRITE_BLOCKED_ERROR);
  }
}

export const HERO_INCIDENT_REVOKE_NOTE =
  "In-app revoking is paused during maintenance, and the list below is not read from your wallet. Check and revoke your real token approvals directly at revoke.cash.";

export const HERO_INCIDENT_REVOKE_URL = "https://revoke.cash";

export type IncidentStakingAction = "approve" | "stake" | "unstake" | "claim" | "emergency";

const STAKING_EXIT_ACTIONS: ReadonlySet<IncidentStakingAction> = new Set(["unstake", "claim", "emergency"]);

/**
 * Throws while maintenance is on unless the action exits an existing stake
 * (unstake, claim, emergency withdraw). `maintenance` is injectable for tests only.
 */
export function assertStakingActionAllowed(
  action: IncidentStakingAction,
  maintenance: boolean = HERO_INCIDENT_MAINTENANCE,
): void {
  if (maintenance && !STAKING_EXIT_ACTIONS.has(action)) {
    throw new Error(HERO_INCIDENT_WRITE_BLOCKED_ERROR);
  }
}

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
