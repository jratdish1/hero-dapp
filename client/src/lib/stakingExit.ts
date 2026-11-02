/**
 * Exit planning for the live HERO→DAI staking contracts
 * (Base 0xAD79…C722, PulseChain 0xD5F1…297E).
 *
 * On those contracts withdraw(amount) and exit() pay earlyExitPenaltyBps (10%)
 * of the principal to treasury() while isLocked(account) is true; during the
 * 2026-10 incident that treasury is a do-not-fund wallet. emergencyWithdraw()
 * returns the full principal with no penalty but forfeits unclaimed DAI, so a
 * locked exit is claimReward() (when something is owed) then emergencyWithdraw().
 * Once isLocked is false, withdraw(amount) returns the full principal.
 *
 * Every function here fails closed: an unknown lock state never produces a
 * withdraw or exit call.
 */

export type StakingExitCall =
  | { functionName: "withdraw"; args: readonly [bigint] }
  | { functionName: "claimReward"; args?: undefined }
  | { functionName: "emergencyWithdraw"; args?: undefined };

export const STAKING_LOCKED_UNSTAKE_ERROR =
  "Your stake is still locked. Unstaking now pays an early-exit penalty to the staking treasury; use \"Withdraw without penalty\" instead.";
export const STAKING_LOCK_UNKNOWN_ERROR =
  "Could not read your lock status from the staking contract. Nothing was sent; try again.";

/** Penalty the contract would take from `amount` while locked. */
export function earlyExitPenalty(amount: bigint, penaltyBps: bigint): bigint {
  if (amount <= 0n || penaltyBps <= 0n) return 0n;
  return (amount * penaltyBps) / 10_000n;
}

/** Plain withdraw: allowed only when the contract says the position is unlocked. */
export function planUnstake(isLocked: boolean | undefined, amount: bigint): StakingExitCall[] {
  if (isLocked === undefined) throw new Error(STAKING_LOCK_UNKNOWN_ERROR);
  if (isLocked) throw new Error(STAKING_LOCKED_UNSTAKE_ERROR);
  if (amount <= 0n) throw new Error("Enter an amount to unstake");
  return [{ functionName: "withdraw", args: [amount] }];
}

/**
 * Penalty-free full exit at any time: claim owed DAI first (emergencyWithdraw
 * forfeits it), then emergencyWithdraw for the whole principal.
 */
export function planPenaltyFreeExit(pendingRewards: bigint | undefined): StakingExitCall[] {
  const calls: StakingExitCall[] = [];
  if (pendingRewards !== undefined && pendingRewards > 0n) calls.push({ functionName: "claimReward" });
  calls.push({ functionName: "emergencyWithdraw" });
  return calls;
}
