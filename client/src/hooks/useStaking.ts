import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { STAKING_ABI } from "../lib/staking-abi";
import { useNetwork } from "../contexts/NetworkContext";
import { useState, useMemo } from "react";

// V2 SSS Contract Addresses (Synthetix-style)
const STAKING_ADDRESSES: Record<number, `0x${string}`> = {
  8453: "0xAD7991a61e5d5C242839445EAAFE244500EEC722",   // Base
  369: "0xD5F173973eC653E6CD1A6B31d742501A1004297E",    // PulseChain
};

// ERC20 approve ABI
const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export function useStakingStats(overrideChainId?: number) {
  const { chainId: networkChainId } = useNetwork();
  const chainId = overrideChainId ?? networkChainId;
  const stakingAddress = STAKING_ADDRESSES[chainId];

  const baseArgs = {
    address: stakingAddress,
    abi: STAKING_ABI,
    chainId,
  };

  // V2 Synthetix-style reads
  const { data: totalSupply } = useReadContract({ ...baseArgs, functionName: "totalSupply" });
  const { data: rewardRateRaw } = useReadContract({ ...baseArgs, functionName: "rewardRate" });
  const { data: rewardsDuration } = useReadContract({ ...baseArgs, functionName: "rewardsDuration" });
  const { data: periodFinish } = useReadContract({ ...baseArgs, functionName: "periodFinish" });
  const { data: isPaused } = useReadContract({ ...baseArgs, functionName: "paused" });
  const { data: stakingToken } = useReadContract({ ...baseArgs, functionName: "stakingToken" });
  const { data: rewardsToken } = useReadContract({ ...baseArgs, functionName: "rewardsToken" });

  // Compute APY from rewardRate and totalSupply
  const computedAPY = useMemo(() => {
    if (!totalSupply || !rewardRateRaw) return BigInt(0);
    const ts = totalSupply as bigint;
    const rr = rewardRateRaw as bigint;
    if (ts === BigInt(0)) return BigInt(100000); // 1000% if no stakers (max display)
    // APY in basis points = (rewardRate * 365 * 86400 * 10000) / totalSupply
    const annualRewards = rr * BigInt(365) * BigInt(86400);
    const apyBps = (annualRewards * BigInt(10000)) / ts;
    return apyBps;
  }, [totalSupply, rewardRateRaw]);

  // Compute reward pool balance (remaining rewards in current period)
  const rewardPoolBalance = useMemo(() => {
    if (!rewardRateRaw || !periodFinish) return BigInt(0);
    const rr = rewardRateRaw as bigint;
    const pf = periodFinish as bigint;
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (pf <= now) return BigInt(0);
    return rr * (pf - now);
  }, [rewardRateRaw, periodFinish]);

  return {
    totalStaked: totalSupply as bigint | undefined,
    currentAPY: computedAPY,
    rewardPoolBalance,
    lockPeriod: rewardsDuration as bigint | undefined,
    lockPeriodSeconds: rewardsDuration as bigint | undefined,
    penaltyBps: BigInt(0), // V2 has no penalty
    isPaused: isPaused as boolean | undefined,
    totalRewardsPaid: BigInt(0), // Not tracked in V2
    rewardRate: rewardRateRaw as bigint | undefined,
    stakingToken: stakingToken as `0x${string}` | undefined,
    rewardsToken: rewardsToken as `0x${string}` | undefined,
    stakingAddress,
  };
}

export function useUserStaking(overrideChainId?: number) {
  const { chainId: networkChainId } = useNetwork();
  const chainId = overrideChainId ?? networkChainId;
  const { address } = useAccount();
  const stakingAddress = STAKING_ADDRESSES[chainId];

  const baseArgs = {
    address: stakingAddress,
    abi: STAKING_ABI,
    chainId,
  };

  // User-specific reads
  const { data: userStaked } = useReadContract({
    ...baseArgs,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: pendingRewards } = useReadContract({
    ...baseArgs,
    functionName: "earned",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Token balance (for staking)
  const { data: stakingToken } = useReadContract({
    ...baseArgs,
    functionName: "stakingToken",
  });

  const { data: tokenBalance } = useReadContract({
    address: stakingToken as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address && !!stakingToken },
  });

  const { data: allowance } = useReadContract({
    address: stakingToken as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && stakingAddress ? [address, stakingAddress] : undefined,
    chainId,
    query: { enabled: !!address && !!stakingToken },
  });

  return {
    userStaked: userStaked as bigint | undefined,
    pendingRewards: pendingRewards as bigint | undefined,
    tokenBalance: tokenBalance as bigint | undefined,
    allowance: allowance as bigint | undefined,
    isUnlocked: true, // V2 has no lock period for withdrawals
    unlockTime: BigInt(0),
  };
}

export function useStakingActions(overrideChainId?: number) {
  const { chainId: networkChainId } = useNetwork();
  const chainId = overrideChainId ?? networkChainId;
  const stakingAddress = STAKING_ADDRESSES[chainId];
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: stakingToken } = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "stakingToken",
    chainId,
  });

  const approve = (amount: string) => {
    if (!stakingToken || !stakingAddress) return;
    writeContract({
      address: stakingToken as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [stakingAddress, parseUnits(amount, 18)],
      chainId,
    });
  };

  const stake = (amount: string) => {
    writeContract({
      address: stakingAddress,
      abi: STAKING_ABI,
      functionName: "stake",
      args: [parseUnits(amount, 18)],
      chainId,
    });
  };

  const withdraw = (amount: string) => {
    writeContract({
      address: stakingAddress,
      abi: STAKING_ABI,
      functionName: "withdraw",
      args: [parseUnits(amount, 18)],
      chainId,
    });
  };

  const claimRewards = () => {
    writeContract({
      address: stakingAddress,
      abi: STAKING_ABI,
      functionName: "getReward",
      chainId,
    });
  };

  const exitAll = () => {
    writeContract({
      address: stakingAddress,
      abi: STAKING_ABI,
      functionName: "exit",
      chainId,
    });
  };

  return {
    approve,
    stake,
    unstake: withdraw,
    claimRewards,
    emergencyWithdraw: exitAll,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}


// --- Compatibility Aliases & Utilities ---
// These maintain backward compatibility with HeroStake.tsx

// Address exports
export const HERO_STAKING_ADDRESS = STAKING_ADDRESSES;
export function getStakingAddress(chainId: number): `0x${string}` | undefined {
  return STAKING_ADDRESSES[chainId];
}

// Alias for useUserStaking (HeroStake.tsx imports useUserStake)
export const useUserStake = useUserStaking;

// Format utilities
export function formatHero(value: bigint | undefined | null): string {
  if (!value) return "0";
  return Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatDai(value: bigint | undefined | null): string {
  if (!value) return "0";
  return Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function formatAPY(value: bigint | undefined | null): string {
  if (!value) return "0";
  // Value is in basis points (10000 = 100%)
  const pct = Number(value) / 100;
  return pct.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function formatLockPeriod(seconds: bigint | undefined | null): string {
  if (!seconds || seconds === BigInt(0)) return "No lock";
  const s = Number(seconds);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// Countdown hook for lock period display
export function useCountdown(targetTimestamp: bigint | undefined): string {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Update every second
  useState(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  });

  if (!targetTimestamp || targetTimestamp === BigInt(0)) return "";
  const remaining = Number(targetTimestamp) - now;
  if (remaining <= 0) return "Unlocked";

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const mins = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
