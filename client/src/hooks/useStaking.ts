import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits, type Address, type Hash } from "viem";
import { isValidChainId, validateDecimalInput } from "../lib/validation";
import { STAKING_ABI } from "../lib/staking-abi";
import { useNetwork } from "../contexts/NetworkContext";
import { getStakingAddress } from "../lib/config";

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

type StakingAction = "approve" | "stake" | "unstake" | "claim" | "emergency";
type SupportedChainId = 369 | 8453;

function supportedChainId(chainId: number | undefined): SupportedChainId | undefined {
  return isValidChainId(chainId) ? chainId : undefined;
}

export function useStakingStats(overrideChainId?: number) {
  const { chainId: networkChainId } = useNetwork();
  const chainId = supportedChainId(overrideChainId ?? networkChainId);
  const stakingAddress = getStakingAddress(chainId);
  const enabled = Boolean(chainId && stakingAddress);

  const totalSupplyQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "totalSupply",
    chainId,
    query: { enabled },
  });
  const rewardRateQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "rewardRate",
    chainId,
    query: { enabled },
  });
  const rewardsDurationQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "rewardsDuration",
    chainId,
    query: { enabled },
  });
  const periodFinishQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "periodFinish",
    chainId,
    query: { enabled },
  });
  const pausedQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "paused",
    chainId,
    query: { enabled },
  });
  const stakingTokenQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "stakingToken",
    chainId,
    query: { enabled },
  });
  const rewardsTokenQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "rewardsToken",
    chainId,
    query: { enabled },
  });

  const rewardsToken = rewardsTokenQuery.data as Address | undefined;
  const rewardPoolQuery = useReadContract({
    address: rewardsToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: stakingAddress ? [stakingAddress] : undefined,
    chainId,
    query: { enabled: Boolean(enabled && rewardsToken && stakingAddress) },
  });

  const totalSupply = totalSupplyQuery.data as bigint | undefined;
  const rewardRate = rewardRateQuery.data as bigint | undefined;
  const periodFinish = periodFinishQuery.data as bigint | undefined;

  const currentAPY = useMemo(() => {
    if (!totalSupply || !rewardRate) return 0n;
    if (totalSupply === 0n) return 100_000n;
    const annualRewards = rewardRate * 365n * 86_400n;
    return (annualRewards * 10_000n) / totalSupply;
  }, [totalSupply, rewardRate]);

  const scheduledRewardsRemaining = useMemo(() => {
    if (!rewardRate || !periodFinish) return 0n;
    const now = BigInt(Math.floor(Date.now() / 1000));
    return periodFinish > now ? rewardRate * (periodFinish - now) : 0n;
  }, [rewardRate, periodFinish]);

  const rewardPoolBalance = rewardPoolQuery.data as bigint | undefined;

  return {
    totalStaked: totalSupply,
    currentAPY,
    actualRewardPoolBalance: rewardPoolBalance,
    rewardPoolBalance,
    scheduledRewardsRemaining,
    lockPeriod: rewardsDurationQuery.data as bigint | undefined,
    lockPeriodSeconds: rewardsDurationQuery.data as bigint | undefined,
    penaltyBps: 0n,
    isPaused: pausedQuery.data as boolean | undefined,
    totalRewardsPaid: 0n,
    rewardRate,
    stakingToken: stakingTokenQuery.data as Address | undefined,
    rewardsToken,
    stakingAddress,
    rewardPoolError: rewardPoolQuery.error?.message,
  };
}

export function useUserStaking(overrideChainId?: number) {
  const { chainId: networkChainId } = useNetwork();
  const chainId = supportedChainId(overrideChainId ?? networkChainId);
  const { address } = useAccount();
  const stakingAddress = getStakingAddress(chainId);
  const enabled = Boolean(chainId && stakingAddress);

  const userStakeQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: Boolean(enabled && address) },
  });
  const rewardsQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "earned",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: Boolean(enabled && address) },
  });
  const stakingTokenQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "stakingToken",
    chainId,
    query: { enabled },
  });

  const stakingToken = stakingTokenQuery.data as Address | undefined;
  const tokenBalanceQuery = useReadContract({
    address: stakingToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: Boolean(chainId && stakingToken && address) },
  });
  const allowanceQuery = useReadContract({
    address: stakingToken,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && stakingAddress ? [address, stakingAddress] : undefined,
    chainId,
    query: { enabled: Boolean(chainId && stakingToken && address && stakingAddress) },
  });

  const refetchAll = async () => {
    await Promise.all([
      userStakeQuery.refetch(),
      rewardsQuery.refetch(),
      stakingTokenQuery.refetch(),
      tokenBalanceQuery.refetch(),
      allowanceQuery.refetch(),
    ]);
  };

  return {
    stakedAmount: userStakeQuery.data as bigint | undefined,
    pendingRewards: rewardsQuery.data as bigint | undefined,
    heroBalance: tokenBalanceQuery.data as bigint | undefined,
    heroAllowance: allowanceQuery.data as bigint | undefined,
    isUnlocked: true,
    unlockTime: 0n,
    refetchAll,
  };
}

export function useStakingActions(overrideChainId?: number) {
  const { chainId: networkChainId } = useNetwork();
  const chainId = supportedChainId(overrideChainId ?? networkChainId);
  const stakingAddress = getStakingAddress(chainId);
  const publicClient = usePublicClient({ chainId });
  const {
    writeContractAsync,
    data: submittedHash,
    isPending,
    reset,
  } = useWriteContract();
  const [pendingAction, setPendingAction] = useState<StakingAction | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastConfirmedHash, setLastConfirmedHash] = useState<Hash | undefined>();

  const stakingTokenQuery = useReadContract({
    address: stakingAddress,
    abi: STAKING_ABI,
    functionName: "stakingToken",
    chainId,
    query: { enabled: Boolean(chainId && stakingAddress) },
  });
  const stakingToken = stakingTokenQuery.data as Address | undefined;

  async function waitForConfirmation(hash: Hash): Promise<Hash> {
    if (!publicClient) throw new Error("No public client available for the selected chain");
    setIsConfirming(true);
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      setLastConfirmedHash(hash);
      setIsSuccess(true);
      return hash;
    } finally {
      setIsConfirming(false);
    }
  }

  async function runAction(
    action: StakingAction,
    submit: () => Promise<Hash>,
  ): Promise<Hash> {
    setPendingAction(action);
    setIsSuccess(false);
    reset();
    try {
      const hash = await submit();
      return await waitForConfirmation(hash);
    } finally {
      setPendingAction(null);
    }
  }

  const approve = async (amount: string) => {
    if (!chainId || !stakingToken || !stakingAddress) throw new Error("Staking is unavailable on this chain");
    if (!validateDecimalInput(amount, 18)) throw new Error("Invalid approval amount");
    const parsedAmount = parseUnits(amount, 18);
    return runAction("approve", () =>
      writeContractAsync({
        address: stakingToken,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [stakingAddress, parsedAmount],
        chainId,
      }),
    );
  };

  const stake = async (amount: string) => {
    if (!chainId || !stakingAddress) throw new Error("Staking is unavailable on this chain");
    if (!validateDecimalInput(amount, 18)) throw new Error("Invalid stake amount");
    const parsedAmount = parseUnits(amount, 18);
    return runAction("stake", () =>
      writeContractAsync({
        address: stakingAddress,
        abi: STAKING_ABI,
        functionName: "stake",
        args: [parsedAmount],
        chainId,
      }),
    );
  };

  const unstake = async (amount: string) => {
    if (!chainId || !stakingAddress) throw new Error("Staking is unavailable on this chain");
    if (!validateDecimalInput(amount, 18)) throw new Error("Invalid unstake amount");
    const parsedAmount = parseUnits(amount, 18);
    return runAction("unstake", () =>
      writeContractAsync({
        address: stakingAddress,
        abi: STAKING_ABI,
        functionName: "withdraw",
        args: [parsedAmount],
        chainId,
      }),
    );
  };

  const claimRewards = async () => {
    if (!chainId || !stakingAddress) throw new Error("Staking is unavailable on this chain");
    return runAction("claim", () =>
      writeContractAsync({
        address: stakingAddress,
        abi: STAKING_ABI,
        functionName: "getReward",
        chainId,
      }),
    );
  };

  const emergencyWithdraw = async () => {
    if (!chainId || !stakingAddress) throw new Error("Staking is unavailable on this chain");
    return runAction("emergency", () =>
      writeContractAsync({
        address: stakingAddress,
        abi: STAKING_ABI,
        functionName: "exit",
        chainId,
      }),
    );
  };

  return {
    approve,
    stake,
    unstake,
    claimRewards,
    emergencyWithdraw,
    isPending,
    isConfirming,
    isSuccess,
    hash: lastConfirmedHash || submittedHash,
    pendingAction,
    isApproving: pendingAction === "approve",
    isStaking: pendingAction === "stake",
    isUnstaking: pendingAction === "unstake",
    isClaiming: pendingAction === "claim",
    isEmergencyWithdrawing: pendingAction === "emergency",
  };
}

export const useUserStake = useUserStaking;

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
  return (Number(value) / 100).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function formatLockPeriod(seconds: bigint | undefined | null): string {
  if (!seconds || seconds === 0n) return "No lock";
  const value = Number(seconds);
  if (value < 3_600) return `${Math.floor(value / 60)}m`;
  if (value < 86_400) return `${Math.floor(value / 3_600)}h`;
  return `${Math.floor(value / 86_400)}d`;
}

export interface CountdownValue {
  remaining: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const EMPTY_COUNTDOWN: CountdownValue = {
  remaining: 0,
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
};

export function useCountdown(targetTimestamp: bigint | undefined): CountdownValue {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!targetTimestamp || targetTimestamp === 0n) return;
    const interval = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1_000);
    return () => window.clearInterval(interval);
  }, [targetTimestamp]);

  if (!targetTimestamp || targetTimestamp === 0n) return EMPTY_COUNTDOWN;
  const remaining = Math.max(Number(targetTimestamp) - now, 0);
  return {
    remaining,
    days: Math.floor(remaining / 86_400),
    hours: Math.floor((remaining % 86_400) / 3_600),
    minutes: Math.floor((remaining % 3_600) / 60),
    seconds: remaining % 60,
  };
}
