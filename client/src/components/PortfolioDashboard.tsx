/**
 * PortfolioDashboard — Shows user's HERO holdings, staking positions,
 * rewards earned, and DAO voting power across both chains.
 */
import { useAccount, useChainId, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import {
  Wallet,
  TrendingUp,
  Lock,
  Gift,
  Vote,
  BarChart3,
  Layers,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WalletIdentity } from "./WalletIdentity";
import { getHeroAddress, getStakingAddress } from "@/lib/config";

// ─── Contract Addresses (from shared config) ────────────────────────────
const CONTRACTS = {
  base: {
    hero: getHeroAddress(8453) ?? "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
    staking: getStakingAddress(8453) ?? "0xAD7991a61e5d5C242839445EAAFE244500EEC722",
  },
  pulsechain: {
    hero: getHeroAddress(369) ?? "0x35a51Dfc82032682E4Bda8AAc87B9Bc386C3D27",
    staking: getStakingAddress(369) ?? "0xD5F173973eC653E6CD1A6B31d742501A1004297E",
  },
};

// ─── ABIs (minimal) ─────────────────────────────────────────────────────
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const STAKING_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "stakes",
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "duration", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "earned",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalStaked",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── Stat Card ──────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = "text-hero-orange",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border/30 hover:border-hero-orange/20 transition-colors">
      <div className={`p-2 rounded-lg bg-muted/50 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-bold text-foreground truncate">{value}</p>
        {subValue && (
          <p className="text-[10px] text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────
export default function PortfolioDashboard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const isBase = chainId === 8453;
  const contracts = isBase ? CONTRACTS.base : CONTRACTS.pulsechain;
  const chainName = isBase ? "BASE" : "PulseChain";

  // Read HERO balance
  const {
    data: heroBalance,
    error: heroBalanceError,
    isLoading: heroBalanceLoading,
  } = useReadContract({
    address: contracts.hero,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 30000 },
  });

  // Read staking position
  const {
    data: stakeData,
    error: stakeError,
    isLoading: stakeLoading,
  } = useReadContract({
    address: contracts.staking,
    abi: STAKING_ABI,
    functionName: "stakes",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 30000 },
  });

  // Read earned rewards
  const {
    data: earnedData,
    error: earnedError,
    isLoading: earnedLoading,
  } = useReadContract({
    address: contracts.staking,
    abi: STAKING_ABI,
    functionName: "earned",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 30000 },
  });

  // Read total staked
  const {
    data: totalStaked,
    error: totalStakedError,
    isLoading: totalStakedLoading,
  } = useReadContract({
    address: contracts.staking,
    abi: STAKING_ABI,
    functionName: "totalStaked",
    query: { enabled: true, refetchInterval: 60000 },
  });

  // ─── Handle loading state ─────────────────────────────────────────────
  const isLoading =
    isConnected &&
    (heroBalanceLoading || stakeLoading || earnedLoading || totalStakedLoading);

  // ─── Handle error state ───────────────────────────────────────────────
  const criticalError = heroBalanceError || stakeError;
  if (criticalError && isConnected) {
    const errorMsg =
      criticalError.message?.includes("network")
        ? "Network error — please check your connection and try again."
        : criticalError.message?.includes("revert")
          ? "Contract call reverted — the staking contract may not be deployed on this chain."
          : "Unable to fetch on-chain data. Please try again later.";
    return (
      <Card className="border-red-500/30 bg-card/50">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-400 font-medium">Failed to load portfolio</p>
          <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
        </CardContent>
      </Card>
    );
  }

  // ─── Format values ──────────────────────────────────────────────────
  const heroHeld = heroBalance
    ? Number(formatUnits(heroBalance as bigint, 18)).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })
    : "0";

  const stakedAmount = stakeData
    ? Number(formatUnits((stakeData as [bigint, bigint, bigint])[0], 18)).toLocaleString(
        undefined,
        { maximumFractionDigits: 0 }
      )
    : "0";

  const rewardsEarned = earnedData
    ? Number(formatUnits(earnedData as bigint, 18)).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })
    : earnedError
      ? "Error"
      : "0";

  const totalStakedFormatted = totalStaked
    ? Number(formatUnits(totalStaked as bigint, 18)).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })
    : totalStakedError
      ? "Error"
      : "—";

  // Calculate staking duration remaining
  const stakeDuration = stakeData
    ? (() => {
        const [, startTime, duration] = stakeData as [bigint, bigint, bigint];
        if (startTime === 0n) return null;
        const endTime = Number(startTime) + Number(duration);
        const now = Math.floor(Date.now() / 1000);
        const remaining = endTime - now;
        if (remaining <= 0) return "Matured";
        const days = Math.floor(remaining / 86400);
        return `${days}d remaining`;
      })()
    : null;

  // Voting power = held + staked
  const votingPower =
    heroBalance && stakeData
      ? Number(
          formatUnits(
            (heroBalance as bigint) + (stakeData as [bigint, bigint, bigint])[0],
            18
          )
        ).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : heroHeld;

  if (!isConnected) {
    return (
      <Card className="border-border/30 bg-card/50">
        <CardContent className="p-8 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Connect your wallet to view your HERO portfolio
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-border/30 bg-card/50">
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 text-hero-orange mx-auto mb-3 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading portfolio data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-hero-orange/20 bg-gradient-to-b from-card to-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-hero-orange" />
            My Portfolio
          </CardTitle>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              isBase
                ? "border-blue-500/30 text-blue-400"
                : "border-green-500/30 text-green-400"
            }`}
          >
            {chainName}
          </Badge>
        </div>
        {/* Identity display */}
        <div className="mt-2">
          <WalletIdentity address={address} showAvatar size="md" />
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={Wallet}
            label="HERO Held"
            value={heroHeld}
            color="text-hero-orange"
          />
          <StatCard
            icon={Lock}
            label="HERO Staked"
            value={stakedAmount}
            subValue={stakeDuration || undefined}
            color="text-blue-400"
          />
          <StatCard
            icon={Gift}
            label="Rewards (DAI)"
            value={rewardsEarned}
            color="text-hero-green"
          />
          <StatCard
            icon={Vote}
            label="Voting Power"
            value={votingPower}
            color="text-purple-400"
          />
        </div>

        {/* Pool Stats */}
        <div className="mt-3 p-3 rounded-xl bg-muted/20 border border-border/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Pool Staked</span>
            </div>
            <span className="text-xs font-semibold text-foreground">
              {totalStakedFormatted} HERO
            </span>
          </div>
          {totalStaked && Number(totalStaked) > 0 && heroBalance && (stakeData as [bigint, bigint, bigint])?.[0] > 0n && (
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground">Your Pool Share</span>
              <span className="text-[10px] font-medium text-hero-orange">
                {(
                  (Number((stakeData as [bigint, bigint, bigint])[0]) /
                    Number(totalStaked as bigint)) *
                  100
                ).toFixed(2)}
                %
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
