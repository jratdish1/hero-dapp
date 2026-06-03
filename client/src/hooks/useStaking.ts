import { isValidChainId, isValidAmount, validateDecimalInput, isBalanceSufficient } from "../lib/validation";
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { STAKING_ABI } from "../lib/staking-abi";
import { useNetwork } from "../contexts/NetworkContext";
import { useState, useMemo, useEffect } from "react";

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

  // Validated chainId for wagmi (only 8453 or 369 allowed)
  const validChainId = (chainId === 8453 || chainId === 369) ? chainId : undefined;

  const baseArgs = {
    address: stakingAddress,
    abi: STAKING_ABI,
    chainId: validChainId,
  };

  // V2 Synthetix-style reads - conditionally enabled based on valid chainId
  const { data: totalSupply } = useReadContract(
    validChainId
      ? { address: stakingAddress, abi: STAKING_ABI, chainId: validChainId, functionName: "totalSupply" }
      : { address: stakingAddress, abi: STAKING_ABI, functionName: "totalSupply", query: { enabled: false } }
  );
  const { data: rewardRateRaw } = useReadContract(
    validChainId
      ? { address: stakingAddress, abi: STAKING_ABI, chainId: validChainId, functionName: "rewardRate" }
      : { address: stakingAddress, abi: STAKING_ABI, functionName: "rewardRate", query: { enabled: false } }
  );
  const { data: rewardsDuration } = useReadContract(
    validChainId
      ? { address: stakingAddress, abi: STAKING_ABI, chainId: validChainId, functionName: "rewardsDuration" }
      : { address: stakingAddress, abi: STAKING_ABI, functionName: "rewardsDuration", query: { enabled: false } }
  );
  const { data: periodFinish } = useReadContract(
    validChainId
      ? { address: stakingAddress, abi: STAKING_ABI, chainId: validChainId, functionName: "periodFinish" }
      : { address: stakingAddress, abi: STAKING_ABI, functionName: "periodFinish", query: { enabled: false } }
  );
  const { data: isPaused } = useReadContract(
    validChainId
      ? { address: stakingAddress, abi: STAKING_ABI, chainId: validChainId, functionName: "paused" }
      : { address: stakingAddress, abi: STAKING_ABI, functionName: "paused", query: { enabled: false } }
  );
  const { data: stakingToken } = useReadContract(
    validChainId
      ? { address: stakingAddress, abi: STAKING_ABI, chainId: validChainId, functionName: "stakingToken" }
      : { address: stakingAddress, abi: STAKING_ABI, functionName: "stakingToken", query: { enabled: false } }
  );
  const { data: rewardsToken } = useReadContract(
    validChainId
      ? { address: stakingAddress, abi: STAKING_ABI, chainId: validChainId, functionName: "rewardsToken" }
      : { address: stakingAddress, abi: STAKING_ABI, functionName: "rewardsToken", query: { enabled: false } }
  );

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

  // Validated chainId for wagmi (only 8453 or 369 allowed)
  const validChainId = (chainId === 8453 || chainId === 369) ? chainId : undefined;

  // User-specific reads
  const { data: userStaked } = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: validChainId,
  });

  const { data: pendingRewards } = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "earned",
    args: address ? [address] : undefined,
    chainId: validChainId,
  });

  // Token balance (for staking)
  const { data: stakingToken } = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "stakingToken",
    chainId: validChainId,
  });

  const { data: tokenBalance } = useReadContract({
    address: stakingToken as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: validChainId,
  });

  const { data: allowance } = useReadContract({
    address: stakingToken as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && stakingAddress ? [address, stakingAddress] : undefined,
    chainId: validChainId,
  });

  return {
    userStaked: userStaked as bigint | undefined,
    pendingRewards: pendingRewards as bigint | undefined,
    tokenBalance: tokenBalance as bigint | undefined,
    allowance: allowance as bigint | undefined,
    isUnlocked: true, // V2 has no lock period for withdrawals
    unlockTime: BigInt(0),
    // Aliases for HeroStake.tsx compatibility
    heroBalance: tokenBalance as bigint | undefined,
    stakedAmount: userStaked as bigint | undefined,
    heroAllowance: allowance as bigint | undefined,
    // Placeholder refetch (real implementation would use useQueryClient)
    refetchAll: () => {},
  };
}

export function useStakingActions(overrideChainId?: number) {
  const { chainId: networkChainId } = useNetwork();
  const chainId = overrideChainId ?? networkChainId;
  // Validated chainId for wagmi
  const validChainId = (chainId === 8453 || chainId === 369) ? chainId : undefined;
  const stakingAddress = STAKING_ADDRESSES[chainId];
  const { writeContract, data: hash, isPending } = useWriteContract({
    mutation: {
      onError: (error: Error) => {
        console.error("[Contract Write Error]", error.message);
      },
    },
  });
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: stakingToken } = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "stakingToken",
    chainId: validChainId,
    query: { enabled: !!validChainId },
  });

  const approve = (amount: string) => {
    if (!stakingToken || !stakingAddress) return;
    if (!isValidChainId(chainId)) { console.error("Unsupported chain:", chainId); return; }
    if (!validateDecimalInput(amount, 18)) { console.error("Invalid amount format:", amount); return; }
    try {
      const parsedAmount = parseUnits(amount, 18);
      writeContract({
        address: stakingToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [stakingAddress, parsedAmount],
        chainId,
      });
    } catch (e) {
      console.error("Error in approve:", e);
    }
  };

  const stake = (amount: string) => {
    if (!isValidChainId(chainId)) { console.error("Unsupported chain:", chainId); return; }
    if (!validateDecimalInput(amount, 18)) { console.error("Invalid stake amount:", amount); return; }
    try {
      const parsedAmount = parseUnits(amount, 18);
      writeContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        functionName: "stake",
        args: [parsedAmount],
        chainId,
      });
    } catch (e) {
      console.error("Error in stake:", e);
    }
  };

  const withdraw = (amount: string) => {
    if (!isValidChainId(chainId)) { console.error("Unsupported chain:", chainId); return; }
    if (!validateDecimalInput(amount, 18)) { console.error("Invalid withdraw amount:", amount); return; }
    try {
      const parsedAmount = parseUnits(amount, 18);
      writeContract({
        address: stakingAddress,
        abi: STAKING_ABI,
        functionName: "withdraw",
        args: [parsedAmount],
        chainId,
      });
    } catch (e) {
      console.error("Error in withdraw:", e);
    }
  };

  const claimRewards = () => {
    if (!isValidChainId(chainId) || !stakingAddress) { console.error("Unsupported chain:", chainId); return; }
    writeContract({
      address: stakingAddress,
      abi: STAKING_ABI,
      functionName: "getReward",
      chainId,
    });
  };

  const exitAll = () => {
    if (!isValidChainId(chainId) || !stakingAddress) { console.error("Unsupported chain:", chainId); return; }
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
    // Legacy aliases (V2 has atomic txs so these all map to isPending)
    isApproving: isPending,
    isStaking: isPending,
    isUnstaking: isPending,
    isClaiming: isPending,
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
export function useCountdown(targetTimestamp: bigint | undefined): { days: number; hours: number; minutes: number; seconds: number } {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!targetTimestamp || targetTimestamp === BigInt(0)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const remaining = Math.max(0, Number(targetTimestamp) - now);
  return {
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
  };
}
