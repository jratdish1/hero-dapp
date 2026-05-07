import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { erc20Abi, type Address, parseUnits, formatUnits } from "viem";
import { HERO_STAKING_ABI } from "@/lib/staking-abi";
import { useMemo, useState, useEffect, useCallback } from "react";

// ─── Contract Addresses (chain-specific after redeployment) ────────
const STAKING_ADDRESSES = {
  8453: "0x54063f7dbc9e70061d6E4ac052B5bf41bF3303ba" as Address,  // BASE
  369: "0x10315dC9a381AF756aA9ca7c46d55ee4f679a0B4" as Address,   // PulseChain
} as const;

export function getStakingAddress(chainId: number | undefined): Address {
  if (chainId === 8453 || chainId === 369) return STAKING_ADDRESSES[chainId];
  return STAKING_ADDRESSES[8453]; // default to Base
}

// Legacy export for backward compatibility
export const HERO_STAKING_ADDRESS = STAKING_ADDRESSES[8453];

// ─── Token Addresses ─────────────────────────────────────────────────
const TOKENS = {
  8453: {
    hero: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8" as Address,
    dai: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" as Address,
  },
  369: {
    hero: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27" as Address,
    dai: "0xefD766cCb38EaF1dfd701853BFCe31359239F305" as Address,
  },
} as const;

type SupportedChainId = 369 | 8453;

function getTokens(chainId: number | undefined) {
  if (chainId === 8453 || chainId === 369) return TOKENS[chainId];
  return TOKENS[8453]; // default to Base
}

// ─── Global Stats Hook ───────────────────────────────────────────────
export function useStakingStats(chainId: SupportedChainId) {
  const baseArgs = {
    address: getStakingAddress(chainId),
    abi: HERO_STAKING_ABI,
    chainId,
  } as const;

  const { data: totalStaked } = useReadContract({ ...baseArgs, functionName: "totalStaked" });
  const { data: currentAPY } = useReadContract({ ...baseArgs, functionName: "currentAPY" });
  const { data: rewardPoolBalance } = useReadContract({ ...baseArgs, functionName: "rewardPoolBalance" });
  const { data: lockPeriod } = useReadContract({ ...baseArgs, functionName: "lockPeriod" });
  const { data: penaltyBps } = useReadContract({ ...baseArgs, functionName: "earlyExitPenaltyBps" });
  const { data: isPaused } = useReadContract({ ...baseArgs, functionName: "paused" });
  const { data: totalRewardsPaid } = useReadContract({ ...baseArgs, functionName: "totalRewardsPaid" });
  const { data: rewardRate } = useReadContract({ ...baseArgs, functionName: "rewardRatePerSecond" });

  return useMemo(() => ({
    totalStaked: totalStaked as bigint | undefined,
    currentAPY: currentAPY as bigint | undefined,
    rewardPoolBalance: rewardPoolBalance as bigint | undefined,
    lockPeriodSeconds: lockPeriod as bigint | undefined,
    penaltyBps: penaltyBps as bigint | undefined,
    isPaused: isPaused as boolean | undefined,
    totalRewardsPaid: totalRewardsPaid as bigint | undefined,
    rewardRate: rewardRate as bigint | undefined,
  }), [totalStaked, currentAPY, rewardPoolBalance, lockPeriod, penaltyBps, isPaused, totalRewardsPaid, rewardRate]);
}

// ─── User Stake Hook ─────────────────────────────────────────────────
export function useUserStake(chainId: SupportedChainId) {
  const { address, isConnected } = useAccount();

  const baseArgs = {
    address: getStakingAddress(chainId),
    abi: HERO_STAKING_ABI,
    chainId,
    query: { enabled: isConnected && !!address },
  } as const;

  const { data: stakeData, refetch: refetchStake } = useReadContract({
    ...baseArgs,
    functionName: "stakes",
    args: address ? [address] : undefined,
  });

  const { data: pendingRewards, refetch: refetchRewards } = useReadContract({
    ...baseArgs,
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
  });

  const { data: isUnlocked } = useReadContract({
    ...baseArgs,
    functionName: "isUnlocked",
    args: address ? [address] : undefined,
  });

  const { data: unlockTime } = useReadContract({
    ...baseArgs,
    functionName: "unlockTime",
    args: address ? [address] : undefined,
  });

  // HERO token balance
  const { data: heroBalance, refetch: refetchHeroBalance } = useReadContract({
    address: getTokens(chainId).hero,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: isConnected && !!address },
  });

  // HERO allowance for staking contract
  const { data: heroAllowance, refetch: refetchAllowance } = useReadContract({
    address: getTokens(chainId).hero,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, getStakingAddress(chainId)] : undefined,
    chainId,
    query: { enabled: isConnected && !!address },
  });

  const refetchAll = useCallback(() => {
    refetchStake();
    refetchRewards();
    refetchHeroBalance();
    refetchAllowance();
  }, [refetchStake, refetchRewards, refetchHeroBalance, refetchAllowance]);

  return useMemo(() => {
    const stakeArr = stakeData as [bigint, bigint, bigint, bigint] | undefined;
    return {
      stakedAmount: stakeArr?.[0],
      rewardDebt: stakeArr?.[1],
      stakeTime: stakeArr?.[2],
      lastClaim: stakeArr?.[3],
      pendingRewards: pendingRewards as bigint | undefined,
      isUnlocked: isUnlocked as boolean | undefined,
      unlockTime: unlockTime as bigint | undefined,
      heroBalance: heroBalance as bigint | undefined,
      heroAllowance: heroAllowance as bigint | undefined,
      refetchAll,
    };
  }, [stakeData, pendingRewards, isUnlocked, unlockTime, heroBalance, heroAllowance, refetchAll]);
}

// ─── Staking Actions Hook ────────────────────────────────────────────
export function useStakingActions(chainId: SupportedChainId) {
  const tokens = getTokens(chainId);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync: writeApprove, isPending: isApproving } = useWriteContract();
  const { writeContractAsync: writeStake, isPending: isStaking } = useWriteContract();
  const { writeContractAsync: writeUnstake, isPending: isUnstaking } = useWriteContract();
  const { writeContractAsync: writeClaim, isPending: isClaiming } = useWriteContract();
  const { writeContractAsync: writeEmergency, isPending: isEmergencyWithdrawing } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  });

  const approve = useCallback(async (amount: bigint) => {
    const hash = await writeApprove({
      address: tokens.hero,
      abi: erc20Abi,
      functionName: "approve",
      args: [getStakingAddress(chainId), amount],
      chainId,
    });
    setPendingTxHash(hash);
    return hash;
  }, [writeApprove, tokens.hero, chainId]);

  const stake = useCallback(async (amount: bigint) => {
    const hash = await writeStake({
      address: getStakingAddress(chainId),
      abi: HERO_STAKING_ABI,
      functionName: "stake",
      args: [amount],
      chainId,
    });
    setPendingTxHash(hash);
    return hash;
  }, [writeStake, chainId]);

  const unstake = useCallback(async (amount: bigint) => {
    const hash = await writeUnstake({
      address: getStakingAddress(chainId),
      abi: HERO_STAKING_ABI,
      functionName: "unstake",
      args: [amount],
      chainId,
    });
    setPendingTxHash(hash);
    return hash;
  }, [writeUnstake, chainId]);

  const claimRewards = useCallback(async () => {
    const hash = await writeClaim({
      address: getStakingAddress(chainId),
      abi: HERO_STAKING_ABI,
      functionName: "claimRewards",
      chainId,
    });
    setPendingTxHash(hash);
    return hash;
  }, [writeClaim, chainId]);

  const emergencyWithdraw = useCallback(async () => {
    const hash = await writeEmergency({
      address: getStakingAddress(chainId),
      abi: HERO_STAKING_ABI,
      functionName: "emergencyWithdraw",
      chainId,
    });
    setPendingTxHash(hash);
    return hash;
  }, [writeEmergency, chainId]);

  return {
    approve,
    stake,
    unstake,
    claimRewards,
    emergencyWithdraw,
    isApproving,
    isStaking,
    isUnstaking,
    isClaiming,
    isEmergencyWithdrawing,
    isConfirming,
    isConfirmed,
    pendingTxHash,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────
export function formatHero(value: bigint | undefined, decimals = 2): string {
  if (!value || value === 0n) return "0.00";
  return Number(formatUnits(value, 18)).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDai(value: bigint | undefined, decimals = 4): string {
  if (!value || value === 0n) return "0.0000";
  return Number(formatUnits(value, 18)).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatAPY(bps: bigint | undefined): string {
  if (!bps) return "0.00";
  return (Number(bps) / 100).toFixed(2);
}

export function formatLockPeriod(seconds: bigint | undefined): string {
  if (!seconds) return "—";
  const days = Number(seconds) / 86400;
  if (days >= 1) return `${days.toFixed(0)} day${days > 1 ? "s" : ""}`;
  const hours = Number(seconds) / 3600;
  return `${hours.toFixed(0)} hour${hours > 1 ? "s" : ""}`;
}

export function useCountdown(targetTimestamp: bigint | undefined) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!targetTimestamp || targetTimestamp === 0n) {
      setRemaining(0);
      return;
    }
    const target = Number(targetTimestamp);
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      setRemaining(Math.max(0, target - now));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  return { remaining, days, hours, minutes, seconds, isExpired: remaining === 0 };
}
