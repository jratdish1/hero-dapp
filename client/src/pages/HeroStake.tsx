import { useState, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { parseUnits } from "viem";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  TrendingUp,
  Coins,
  Lock,
  Unlock,
  Info,
  ExternalLink,
  Zap,
  Award,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  useStakingStats,
  useUserStake,
  useStakingActions,
  formatHero,
  formatDai,
  formatAPY,
  formatLockPeriod,
  useCountdown,
  HERO_STAKING_ADDRESS,
} from "@/hooks/useStaking";

// ─── Chain Config ────────────────────────────────────────────────────
const CHAIN_CONFIG = {
  8453: {
    name: "Base",
    heroCA: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
    explorer: "https://basescan.org",
    color: "#0052FF",
  },
  369: {
    name: "PulseChain",
    heroCA: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
    explorer: "https://scan.pulsechain.com",
    color: "#00FF88",
  },
} as const;

type SupportedChainId = 369 | 8453;

function isSupportedChain(id: number | undefined): id is SupportedChainId {
  return id === 369 || id === 8453;
}

// ─── Stat Card Component ─────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: highlight
          ? "linear-gradient(135deg, rgba(200,168,75,0.15), rgba(200,168,75,0.05))"
          : "rgba(0,0,0,0.3)",
        border: highlight ? "1px solid rgba(200,168,75,0.4)" : "1px solid #3D5A3D",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: "#C8A84B" }} />
        <span className="text-xs" style={{ color: "#8a9a8a" }}>
          {label}
        </span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: "#5a6a5a" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function HeroStake() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const activeChainId: SupportedChainId = isSupportedChain(chainId) ? chainId : 8453;
  const chainConfig = CHAIN_CONFIG[activeChainId];

  // ─── Contract State ──────────────────────────────────────────────
  const stats = useStakingStats(activeChainId);
  const user = useUserStake(activeChainId);
  const actions = useStakingActions(activeChainId);
  const countdown = useCountdown(user.unlockTime);

  // ─── Local State ─────────────────────────────────────────────────
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"stake" | "unstake" | "rewards">("stake");

  // Refetch on confirmed tx
  useEffect(() => {
    if (actions.isConfirmed) {
      user.refetchAll();
      setStakeAmount("");
      setUnstakeAmount("");
    }
  }, [actions.isConfirmed]);

  // ─── Handlers ────────────────────────────────────────────────────
  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast.error("Enter an amount to stake");
      return;
    }
    try {
      const amount = parseUnits(stakeAmount, 18);

      // Check allowance
      if (!user.heroAllowance || user.heroAllowance < amount) {
        toast.info("Approving HERO for staking...", { description: "Please confirm the approval in your wallet" });
        await actions.approve(amount);
        toast.success("Approval confirmed! Now staking...");
        // Refetch allowance before staking
        await new Promise((r) => setTimeout(r, 2000));
        user.refetchAll();
      }

      toast.info("Staking HERO...", { description: `Staking ${stakeAmount} HERO` });
      await actions.stake(amount);
      toast.success("Staked successfully!", {
        description: `${stakeAmount} HERO is now earning DAI rewards`,
      });
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Transaction failed";
      toast.error("Stake failed", { description: msg });
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      toast.error("Enter an amount to unstake");
      return;
    }
    try {
      const amount = parseUnits(unstakeAmount, 18);
      const willPenalize = !user.isUnlocked;

      if (willPenalize) {
        const penaltyPct = stats.penaltyBps ? Number(stats.penaltyBps) / 100 : 10;
        toast.warning(`Early unstake — ${penaltyPct}% penalty applies`, {
          description: "Penalty goes to protocol treasury",
        });
      }

      toast.info("Unstaking HERO...");
      await actions.unstake(amount);
      toast.success("Unstaked successfully!", {
        description: willPenalize
          ? "Early exit penalty was applied"
          : "No penalty — lock period expired",
      });
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Transaction failed";
      toast.error("Unstake failed", { description: msg });
    }
  };

  const handleClaim = async () => {
    try {
      toast.info("Claiming DAI rewards...");
      await actions.claimRewards();
      toast.success("Rewards claimed!", {
        description: "DAI has been sent to your wallet",
      });
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Transaction failed";
      toast.error("Claim failed", { description: msg });
    }
  };

  const handleMaxStake = () => {
    if (user.heroBalance) {
      setStakeAmount(formatHero(user.heroBalance, 18).replace(/,/g, ""));
    }
  };

  const handleMaxUnstake = () => {
    if (user.stakedAmount) {
      setUnstakeAmount(formatHero(user.stakedAmount, 18).replace(/,/g, ""));
    }
  };

  // ─── Derived Values ──────────────────────────────────────────────
  const penaltyPct = stats.penaltyBps ? (Number(stats.penaltyBps) / 100).toFixed(0) : "10";
  const hasStake = user.stakedAmount && user.stakedAmount > 0n;
  const hasPendingRewards = user.pendingRewards && user.pendingRewards > 0n;
  const isAnyTxPending = actions.isApproving || actions.isStaking || actions.isUnstaking || actions.isClaiming || actions.isConfirming;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #C8A84B, #a8882b)",
            }}
          >
            <Shield className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">HERO Staking</h1>
            <p className="text-sm" style={{ color: "#8a9a8a" }}>
              Stake HERO → Earn DAI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge
            className="text-xs"
            style={{
              background: `${chainConfig.color}20`,
              color: chainConfig.color,
              border: `1px solid ${chainConfig.color}40`,
            }}
          >
            {chainConfig.name}
          </Badge>
          {stats.isPaused && (
            <Badge className="text-xs bg-red-500/20 text-red-400 border border-red-500/40">
              <AlertTriangle className="w-3 h-3 mr-1" /> Paused
            </Badge>
          )}
          {!isSupportedChain(chainId) && isConnected && (
            <Badge
              className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 cursor-pointer"
              onClick={() => switchChain?.({ chainId: 8453 })}
            >
              Switch to Base
            </Badge>
          )}
        </div>
      </div>

      {/* Paused Banner */}
      {stats.isPaused && (
        <div
          className="rounded-xl p-4 mb-4 flex items-center gap-3"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
        >
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Staking is temporarily paused</p>
            <p className="text-xs text-red-400/70">
              New stakes and claims are disabled. Emergency withdrawals are available.
            </p>
          </div>
        </div>
      )}

      {/* Global Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard
          label="Total Staked"
          value={`${formatHero(stats.totalStaked)} HERO`}
          icon={Coins}
          highlight
        />
        <StatCard
          label="Current APY"
          value={`${formatAPY(stats.currentAPY)}%`}
          sub="DAI rewards"
          icon={TrendingUp}
          highlight
        />
        <StatCard
          label="Reward Pool"
          value={`${formatDai(stats.rewardPoolBalance)} DAI`}
          icon={Award}
        />
        <StatCard
          label="Lock Period"
          value={formatLockPeriod(stats.lockPeriodSeconds)}
          sub={`${penaltyPct}% early exit penalty`}
          icon={Lock}
        />
      </div>

      {/* User Stats (if staked) */}
      {isConnected && hasStake && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            label="Your Staked"
            value={`${formatHero(user.stakedAmount)} HERO`}
            icon={Shield}
            highlight
          />
          <StatCard
            label="Pending Rewards"
            value={`${formatDai(user.pendingRewards)} DAI`}
            sub={hasPendingRewards ? "Claimable now" : "Accruing..."}
            icon={Award}
            highlight
          />
        </div>
      )}

      {/* Unlock Countdown */}
      {isConnected && hasStake && !user.isUnlocked && countdown.remaining > 0 && (
        <div
          className="rounded-xl p-3 mb-4 flex items-center gap-3"
          style={{
            background: "rgba(200,168,75,0.08)",
            border: "1px solid rgba(200,168,75,0.2)",
          }}
        >
          <Clock className="w-4 h-4" style={{ color: "#C8A84B" }} />
          <div className="flex-1">
            <p className="text-xs" style={{ color: "#8a9a8a" }}>
              Unlock in
            </p>
            <p className="text-sm font-mono font-bold text-white">
              {countdown.days > 0 && `${countdown.days}d `}
              {String(countdown.hours).padStart(2, "0")}:
              {String(countdown.minutes).padStart(2, "0")}:
              {String(countdown.seconds).padStart(2, "0")}
            </p>
          </div>
          <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Lock className="w-3 h-3 mr-1" /> Locked
          </Badge>
        </div>
      )}

      {isConnected && hasStake && user.isUnlocked && (
        <div
          className="rounded-xl p-3 mb-4 flex items-center gap-3"
          style={{
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          <Unlock className="w-4 h-4 text-green-400" />
          <p className="text-sm text-green-400 font-medium">
            Unlocked — unstake without penalty
          </p>
        </div>
      )}

      {/* Connect Wallet Prompt */}
      {!isConnected ? (
        <ConnectWalletPrompt message="Connect your wallet to stake HERO and earn DAI rewards" />
      ) : (
        /* Staking Card */
        <Card
          className="border-0"
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2))",
            border: "1px solid #3D5A3D",
          }}
        >
          <CardHeader className="pb-2">
            {/* Tab Switcher */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: "rgba(0,0,0,0.3)" }}>
              {(["stake", "unstake", "rewards"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all capitalize"
                  style={{
                    background: activeTab === tab ? "rgba(200,168,75,0.2)" : "transparent",
                    color: activeTab === tab ? "#C8A84B" : "#8a9a8a",
                    border: activeTab === tab ? "1px solid rgba(200,168,75,0.3)" : "1px solid transparent",
                  }}
                >
                  {tab === "stake" && <Zap className="w-3 h-3 inline mr-1" />}
                  {tab === "unstake" && <Unlock className="w-3 h-3 inline mr-1" />}
                  {tab === "rewards" && <Award className="w-3 h-3 inline mr-1" />}
                  {tab}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ─── STAKE TAB ──────────────────────────────────── */}
            {activeTab === "stake" && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs" style={{ color: "#8a9a8a" }}>
                      Amount to Stake
                    </label>
                    <span className="text-xs" style={{ color: "#5a6a5a" }}>
                      Balance: {formatHero(user.heroBalance)} HERO
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="bg-black/30 border-[#3D5A3D] text-white"
                      disabled={isAnyTxPending || stats.isPaused}
                    />
                    <button
                      onClick={handleMaxStake}
                      className="px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{
                        background: "rgba(200,168,75,0.15)",
                        color: "#C8A84B",
                        border: "1px solid rgba(200,168,75,0.3)",
                      }}
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-xs" style={{ color: "#8a9a8a" }}>
                  <div className="flex justify-between">
                    <span>Reward Token</span>
                    <span className="text-white">DAI (Stablecoin)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current APY</span>
                    <span style={{ color: "#C8A84B" }}>{formatAPY(stats.currentAPY)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lock Period</span>
                    <span className="text-white">{formatLockPeriod(stats.lockPeriodSeconds)}</span>
                  </div>
                </div>
                <button
                  onClick={handleStake}
                  disabled={isAnyTxPending || stats.isPaused || !stakeAmount}
                  className="w-full py-3 rounded-xl font-bold text-base transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #C8A84B, #a8882b)",
                    color: "#0d1a0d",
                  }}
                >
                  {(actions.isApproving || actions.isStaking || actions.isConfirming) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {actions.isApproving ? "Approving..." : actions.isConfirming ? "Confirming..." : "Staking..."}
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Stake HERO
                    </>
                  )}
                </button>
              </>
            )}

            {/* ─── UNSTAKE TAB ────────────────────────────────── */}
            {activeTab === "unstake" && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs" style={{ color: "#8a9a8a" }}>
                      Amount to Unstake
                    </label>
                    <span className="text-xs" style={{ color: "#5a6a5a" }}>
                      Staked: {formatHero(user.stakedAmount)} HERO
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={unstakeAmount}
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                      className="bg-black/30 border-[#3D5A3D] text-white"
                      disabled={isAnyTxPending || !hasStake}
                    />
                    <button
                      onClick={handleMaxUnstake}
                      className="px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{
                        background: "rgba(200,168,75,0.15)",
                        color: "#C8A84B",
                        border: "1px solid rgba(200,168,75,0.3)",
                      }}
                    >
                      MAX
                    </button>
                  </div>
                </div>
                {!user.isUnlocked && hasStake && (
                  <div
                    className="rounded-lg p-3 text-xs"
                    style={{
                      background: "rgba(224,90,90,0.08)",
                      border: "1px solid rgba(224,90,90,0.2)",
                    }}
                  >
                    <p style={{ color: "#e05a5a" }}>
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      Early unstaking incurs a {penaltyPct}% penalty on your staked HERO.
                      Penalty goes to the protocol treasury.
                    </p>
                  </div>
                )}
                {user.isUnlocked && hasStake && (
                  <div
                    className="rounded-lg p-3 text-xs"
                    style={{
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.2)",
                    }}
                  >
                    <p className="text-green-400">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      Lock period expired — unstake with zero penalty.
                    </p>
                  </div>
                )}
                <button
                  onClick={handleUnstake}
                  disabled={isAnyTxPending || !hasStake || !unstakeAmount}
                  className="w-full py-3 rounded-xl font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: user.isUnlocked
                      ? "linear-gradient(135deg, #22c55e, #16a34a)"
                      : "rgba(224,90,90,0.15)",
                    border: user.isUnlocked ? "none" : "1px solid rgba(224,90,90,0.3)",
                    color: user.isUnlocked ? "#0d1a0d" : "#e05a5a",
                  }}
                >
                  {(actions.isUnstaking || actions.isConfirming) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {actions.isConfirming ? "Confirming..." : "Unstaking..."}
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      {user.isUnlocked ? "Unstake HERO" : "Unstake HERO (Penalty Applies)"}
                    </>
                  )}
                </button>

                {/* Emergency Withdraw (only when paused) */}
                {stats.isPaused && hasStake && (
                  <button
                    onClick={async () => {
                      try {
                        toast.info("Emergency withdraw...");
                        await actions.emergencyWithdraw();
                        toast.success("Emergency withdrawal complete");
                      } catch (err: any) {
                        toast.error("Failed", { description: err?.shortMessage || err?.message });
                      }
                    }}
                    disabled={isAnyTxPending}
                    className="w-full py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      color: "#ef4444",
                    }}
                  >
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Emergency Withdraw (Forfeits Rewards)
                  </button>
                )}
              </>
            )}

            {/* ─── REWARDS TAB ────────────────────────────────── */}
            {activeTab === "rewards" && (
              <>
                <div
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: "rgba(200,168,75,0.08)",
                    border: "1px solid rgba(200,168,75,0.2)",
                  }}
                >
                  <p className="text-xs mb-1" style={{ color: "#8a9a8a" }}>
                    Pending DAI Rewards
                  </p>
                  <p className="text-3xl font-bold" style={{ color: "#C8A84B" }}>
                    {formatDai(user.pendingRewards)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#5a6a5a" }}>
                    DAI Stablecoin
                  </p>
                </div>

                <div className="space-y-2 text-xs" style={{ color: "#8a9a8a" }}>
                  <div className="flex justify-between">
                    <span>Total Rewards Paid (Global)</span>
                    <span className="text-white">{formatDai(stats.totalRewardsPaid)} DAI</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reward Pool Remaining</span>
                    <span className="text-white">{formatDai(stats.rewardPoolBalance)} DAI</span>
                  </div>
                </div>

                <button
                  onClick={handleClaim}
                  disabled={isAnyTxPending || !hasPendingRewards || stats.isPaused}
                  className="w-full py-3 rounded-xl font-bold text-base transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #C8A84B, #a8882b)",
                    color: "#0d1a0d",
                  }}
                >
                  {(actions.isClaiming || actions.isConfirming) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {actions.isConfirming ? "Confirming..." : "Claiming..."}
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4" />
                      Claim DAI Rewards
                    </>
                  )}
                </button>
                <p className="text-center text-xs" style={{ color: "#5a6a5a" }}>
                  Rewards accrue in real-time. Claim anytime with no penalty.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contract Info Footer */}
      <div className="mt-4 space-y-1">
        <div className="flex items-center gap-2 text-xs" style={{ color: "#5a6a5a" }}>
          <Info className="w-3 h-3" />
          <span>
            Staking Contract:{" "}
            <a
              href={`${chainConfig.explorer}/address/${HERO_STAKING_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "#C8A84B", fontFamily: "monospace" }}
            >
              {HERO_STAKING_ADDRESS.slice(0, 10)}...{HERO_STAKING_ADDRESS.slice(-6)}
            </a>
          </span>
          <ExternalLink className="w-3 h-3" />
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: "#5a6a5a" }}>
          <Shield className="w-3 h-3" />
          <span>
            HERO CA:{" "}
            <a
              href={`${chainConfig.explorer}/token/${chainConfig.heroCA}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "#C8A84B", fontFamily: "monospace" }}
            >
              {chainConfig.heroCA.slice(0, 10)}...{chainConfig.heroCA.slice(-6)}
            </a>
          </span>
          <ExternalLink className="w-3 h-3" />
        </div>
        <div className="flex items-center gap-2 text-xs mt-2" style={{ color: "#5a6a5a" }}>
          <CheckCircle className="w-3 h-3 text-green-500" />
          <span className="text-green-500/70">Source verified on {chainConfig.name}</span>
        </div>
      </div>
    </div>
  );
}
