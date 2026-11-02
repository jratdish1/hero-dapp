import { describe, expect, it } from "vitest";
import { encodeFunctionData, toFunctionSelector } from "viem";
import { STAKING_ABI } from "./staking-abi";
import {
  earlyExitPenalty,
  planPenaltyFreeExit,
  planUnstake,
  STAKING_LOCK_UNKNOWN_ERROR,
  STAKING_LOCKED_UNSTAKE_ERROR,
  type StakingExitCall,
} from "./stakingExit";

// Selectors present in the deployed bytecode of Base 0xAD79…C722 and PulseChain 0xD5F1…297E.
const LIVE_SELECTORS = new Set([
  "0x2e1a7d4d", // withdraw(uint256)
  "0xb88a802f", // claimReward()
  "0xdb2e21bc", // emergencyWithdraw()
  "0xa694fc3a", // stake(uint256)
  "0x4a4fbeec", // isLocked(address)
  "0x008cc262", // earned(address)
]);
const WITHDRAW = toFunctionSelector("withdraw(uint256)");
const EXIT = toFunctionSelector("exit()");

function encode(call: StakingExitCall): string {
  return encodeFunctionData({ abi: STAKING_ABI, ...call } as Parameters<typeof encodeFunctionData>[0]);
}

describe("staking exit planning (red-team F1)", () => {
  it("a locked position never encodes withdraw or exit", () => {
    expect(() => planUnstake(true, 10n ** 18n)).toThrow(STAKING_LOCKED_UNSTAKE_ERROR);
    for (const rewards of [undefined, 0n, 5n]) {
      const data = planPenaltyFreeExit(rewards).map(encode);
      expect(data.some((d) => d.startsWith(WITHDRAW) || d.startsWith(EXIT))).toBe(false);
    }
  });

  it("an unknown lock state fails closed", () => {
    expect(() => planUnstake(undefined, 10n ** 18n)).toThrow(STAKING_LOCK_UNKNOWN_ERROR);
  });

  it("penalty-free exit claims owed DAI first, then emergencyWithdraw", () => {
    expect(planPenaltyFreeExit(7n).map((c) => c.functionName)).toEqual(["claimReward", "emergencyWithdraw"]);
    expect(planPenaltyFreeExit(0n).map((c) => c.functionName)).toEqual(["emergencyWithdraw"]);
    expect(planPenaltyFreeExit(undefined).map((c) => c.functionName)).toEqual(["emergencyWithdraw"]);
  });

  it("an unlocked position withdraws the requested amount", () => {
    const [call] = planUnstake(false, 4n * 10n ** 18n);
    expect(encode(call)).toBe(encodeFunctionData({ abi: STAKING_ABI, functionName: "withdraw", args: [4n * 10n ** 18n] }));
  });

  it("every planned call targets a selector the live contracts have", () => {
    const calls = [...planPenaltyFreeExit(1n), ...planUnstake(false, 1n)];
    for (const c of calls) expect(LIVE_SELECTORS.has(encode(c).slice(0, 10))).toBe(true);
  });

  it("the ABI has no getReward, exit, stakingToken or rewardsToken", () => {
    const names = STAKING_ABI.map((f) => f.name);
    for (const absent of ["getReward", "exit", "stakingToken", "rewardsToken"]) expect(names).not.toContain(absent);
    for (const present of ["claimReward", "emergencyWithdraw", "isLocked", "earlyExitPenaltyBps", "heroToken", "daiToken"]) {
      expect(names).toContain(present);
    }
  });

  it("computes the contract's early-exit penalty", () => {
    expect(earlyExitPenalty(10n * 10n ** 18n, 1000n)).toBe(10n ** 18n);
    expect(earlyExitPenalty(0n, 1000n)).toBe(0n);
    expect(earlyExitPenalty(5n, 0n)).toBe(0n);
  });
});
