import { isValidChainId, isValidAmount, validateDecimalInput, isBalanceSufficient } from "../lib/validation";
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { STAKING_ABI } from "../lib/staking-abi";
import { useNetwork } from "../contexts/NetworkContext";
import { useState, useMemo, useEffect } from "react";
import { getStakingAddress, getHeroAddress } from "../lib/config";

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
  const stakingAddress = getStakingAddress(chainId);

  const baseArgs = {
    address: stakingAddress,
    abi: STAKING_ABI,
    chainId,
  };

  // V2 Synthetix-style reads
  const { data: totalSupply } = stakingAddress ? useReadContract({ address: stakingAddress, abi: STAKING_ABI, functionName: "totalSupply", chainId: chainId as 369 | 8453 }) : { data: undefined };
  const { data: rewardRateRaw } = stakingAddress ? useReadContract({ address: stakingAddress, abi: STAKING_ABI, functionName: "rewardRate", chainId: chainId as 369 | 8453 }) : { data: undefined };
  const { data: rewardsDuration } = stakingAddress ? useReadContract({ address: stakingAddress, abi: STAKING_ABI, functionName: "rewardsDuration", chainId: chainId as 369 | 8453 }) : { data: undefined };
  const { data: periodFinish } = stakingAddress ? useReadContract({ address: stakingAddress, abi: STAKING_ABI, functionName: "periodFinish", chainId: chainId as 369 | 8453 }) : { data: undefined };
  const { data: isPaused } = stakingAddress ? useReadContract({ address: stakingAddress, abi: STAKING_ABI, functionName: "paused", chainId: chainId as 369 | 8453 }) : { data: undefined };
  const { data: stakingToken } = stakingAddress ? useReadContract({ address: stakingAddress, abi: STAKING_ABI, functionName: "stakingToken", chainId: chainId as 369 | 8453 }) : { data: undefined };
  const { data: rewardsToken } = stakingAddress ? useReadContract({ address: stakingAddress, abi: STAKING_ABI, functionName: "rewardsToken", chainId: chainId as 369 | 8453 }) : { data: undefined };


  // Read actual reward token balance held by staking contract
  const { data: actualRewardPoolBalance } = rewardsToken && stakingAddress && (chainId === 8453 || chainId === 369) ? useReadContract({
    address: rewardsToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [stakingAddress],
    chainId: chainId as 369 | 8453,
  }) : { data: undefined };



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

  // Compute scheduled rewards remaining (reward emissions left in period)
  const scheduledRewardsRemaining = useMemo(() => {
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
    actualRewardPoolBalance: (!rewardsToken || !stakingAddress || !(chainId === 8453 || chainId === 369)) ? undefined : actualRewardPoolBalance as bigint | undefined,
    scheduledRewardsRemaining,
    lockPeriod: rewardsDuration as bigint | undefined,
    lockPeriodSeconds: rewardsDuration as bigint | undefined,
    penaltyBps: BigInt(0), // V2 has no penalty
    isPaused: isPaused as boolean | undefined,
    totalRewardsPaid: BigInt(0), // Not tracked in V2
    rewardRate: rewardRateRaw as bigint | undefined,
    stakingToken: stakingToken as `0x${string}` | undefined,
    rewardsToken: rewardsToken as `0x${string}` | undefined,
    stakingAddress,
    rewardPoolError: (!rewardsToken || !stakingAddress) ? 'Missing contract address' : undefined,
  };
}

export function useUserStaking(overrideChainId?: number) {
  const { chainId: networkChainId } = useNetwork();
  const chainId = overrideChainId ?? networkChainId;
  const { address } = useAccount();
  const stakingAddress = getStakingAddress(chainId);

  const baseArgs = {
    address: stakingAddress,
    abi: STAKING_ABI,
    chainId: chainId as 369 | 8453,
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

  // Staking token balanceOf: only query if valid address and chainId
  const { data: tokenBalance } = stakingToken && address && (chainId === 8453 || chainId === 369)
    ? useReadContract({
        address: stakingToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
        chainId: chainId as 369 | 8453,
        query: { enabled: true },
      })
    : { data: undefined };

  // Staking token allowance: only query if valid addresses and chainId
  const { data: allowance } = stakingToken && address && stakingAddress && (chainId === 8453 || chainId === 369)
    ? useReadContract({
        address: stakingToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, stakingAddress],
        chainId: chainId as 369 | 8453,
        query: { enabled: true },
      })
    : { data: undefined };


  // Legacy compatibility: export keys as expected in HeroStake
  return {
    stakedAmount: userStaked as bigint | undefined,
    pendingRewards: pendingRewards as bigint | undefined,
    heroBalance: tokenBalance as bigint | undefined,
    heroAllowance: allowance as bigint | undefined,
    isUnlocked: true, // V2 has no lock period for withdrawals
    unlockTime: BigInt(0),
    refetchAll: () => {}, // stub, update as needed
  };
}

export function useStakingActions(overrideChainId?: number) {
  const { chainId: networkChainId } = useNetwork();
  const chainId = overrideChainId ?? networkChainId;
  const stakingAddress = getStakingAddress(chainId);
  const { writeContract, data: hash, isPending } = useWriteContract({
    mutation: {
      onError: (error: Error) => {
        console.error("[Contract Write Error]", error.message);
      },
    },
  });
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: stakingToken } = (stakingAddress && (chainId === 8453 || chainId === 369)) ? useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "stakingToken",
    chainId: chainId as 369 | 8453,
  }) : { data: undefined };


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
        chainId: chainId as 369 | 8453,
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
        address: stakingAddress as `0x${string}`,
        abi: STAKING_ABI,
        functionName: "stake",
        args: [parsedAmount],
        chainId: chainId as 369 | 8453,
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
        address: stakingAddress as `0x${string}`,
        abi: STAKING_ABI,
        functionName: "withdraw",
        args: [parsedAmount],
        chainId: chainId as 369 | 8453,
      });
    } catch (e) {
      console.error("Error in withdraw:", e);
    }
  };

  const claimRewards = () => {
    if (!isValidChainId(chainId) || !stakingAddress) { console.error("Unsupported chain:", chainId); return; }
    writeContract({
      address: stakingAddress as `0x${string}`,
      abi: STAKING_ABI,
      functionName: "getReward",
      chainId: chainId as 369 | 8453,
    });
  };

  const exitAll = () => {
    if (!isValidChainId(chainId) || !stakingAddress) { console.error("Unsupported chain:", chainId); return; }
    writeContract({
      address: stakingAddress as `0x${string}`,
      abi: STAKING_ABI,
      functionName: "exit",
      chainId: chainId as 369 | 8453,
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

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

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
