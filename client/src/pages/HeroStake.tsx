import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { toast } from "sonner";

// HERO token CA on BASE
const HERO_BASE_CA = "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8";
// DAI on BASE
const DAI_BASE_CA = "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb";

const MOCK_STATS = {
  totalStaked: "12,450,000",
  apy: "18.4",
  yourStaked: "0",
  pendingRewards: "0.00",
  rewardToken: "DAI",
  lockPeriod: "7 days",
  earlyExitPenalty: "10%",
};

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
      {sub && <div className="text-xs mt-1" style={{ color: "#5a6a5a" }}>{sub}</div>}
    </div>
  );
}

export default function HeroStake() {
  const { isConnected } = useAccount();
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"stake" | "unstake" | "rewards">("stake");

  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast.error("Enter an amount to stake");
      return;
    }
    toast.info("Single-sided staking contract deploying soon", {
      description: `Will stake ${stakeAmount} HERO for DAI rewards`,
    });
  };

  const handleUnstake = () => {
    toast.info("Unstake coming soon", {
      description: "7-day lock period applies",
    });
  };

  const handleClaim = () => {
    toast.info("Claim rewards coming soon", {
      description: "DAI rewards will be sent to your wallet",
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(200,168,75,0.15)", border: "1px solid rgba(200,168,75,0.3)" }}
          >
            <Shield className="w-5 h-5" style={{ color: "#C8A84B" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#C8A84B" }}>
              HERO Single-Side Stake
            </h1>
            <p className="text-sm text-muted-foreground">Stake HERO → Earn DAI stablecoin rewards</p>
          </div>
          <Badge
            className="ml-auto text-xs"
            style={{ background: "rgba(200,168,75,0.15)", color: "#C8A84B", border: "1px solid rgba(200,168,75,0.3)" }}
          >
            Coming Soon
          </Badge>
        </div>
      </div>

      {/* Strategy explainer */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.2)" }}
      >
        <div className="flex items-start gap-3">
          <Award className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#C8A84B" }} />
          <div className="text-sm space-y-1" style={{ color: "#d4d4c0" }}>
            <p className="font-semibold text-white">The HERO Staking Strategy</p>
            <p>
              Stake your HERO tokens (single-sided — no LP needed) and earn{" "}
              <strong className="text-white">DAI stablecoin</strong> rewards. This rewards HODLers,
              deepens the DAI liquidity pool, and discourages selling pressure on HERO.
            </p>
            <p className="text-xs" style={{ color: "#8a9a8a" }}>
              DAI emissions come from protocol revenue. The more HERO staked, the deeper the DAI/HERO
              liquidity — a flywheel that benefits the entire ecosystem.
            </p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Total HERO Staked" value={MOCK_STATS.totalStaked} sub="HERO tokens" icon={Lock} />
        <StatCard label="Current APY" value={`${MOCK_STATS.apy}%`} sub="Paid in DAI" icon={TrendingUp} highlight />
        <StatCard label="Your Staked" value={isConnected ? MOCK_STATS.yourStaked : "—"} sub="HERO" icon={Coins} />
        <StatCard
          label="Pending Rewards"
          value={isConnected ? `${MOCK_STATS.pendingRewards} DAI` : "—"}
          sub="Claimable now"
          icon={Award}
          highlight={isConnected && parseFloat(MOCK_STATS.pendingRewards) > 0}
        />
      </div>

      {/* Main action card */}
      {!isConnected ? (
        <ConnectWalletPrompt
          title="Connect to Stake HERO"
          description="Connect your wallet to stake HERO and earn DAI stablecoin rewards."
          variant="card"
        />
      ) : (
        <Card style={{ background: "#1C2A1C", border: "1px solid #3D5A3D" }}>
          <CardHeader className="pb-3">
            {/* Tabs */}
            <div
              className="flex rounded-xl p-1 gap-1"
              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #3D5A3D" }}
            >
              {(["stake", "unstake", "rewards"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                  style={
                    activeTab === tab
                      ? {
                          background: "linear-gradient(135deg, #C8A84B, #a8882b)",
                          color: "#0d1a0d",
                        }
                      : { color: "#8a9a8a" }
                  }
                >
                  {tab}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTab === "stake" && (
              <>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#8a9a8a" }}>
                    Amount to Stake
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="bg-black/30 border-[#3D5A3D] text-white"
                    />
                    <button
                      className="px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(200,168,75,0.15)", color: "#C8A84B", border: "1px solid rgba(200,168,75,0.3)" }}
                      onClick={() => setStakeAmount("1000")}
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div
                  className="rounded-lg p-3 text-xs space-y-1"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #3D5A3D" }}
                >
                  <div className="flex justify-between">
                    <span style={{ color: "#8a9a8a" }}>Lock Period</span>
                    <span className="text-white">{MOCK_STATS.lockPeriod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#8a9a8a" }}>Early Exit Penalty</span>
                    <span style={{ color: "#e05a5a" }}>{MOCK_STATS.earlyExitPenalty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#8a9a8a" }}>Reward Token</span>
                    <span className="text-white">DAI (Stablecoin)</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#8a9a8a" }}>Estimated APY</span>
                    <span style={{ color: "#C8A84B" }}>{MOCK_STATS.apy}%</span>
                  </div>
                </div>
                <button
                  onClick={handleStake}
                  className="w-full py-3 rounded-xl font-bold text-base transition-all hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #C8A84B, #a8882b)",
                    color: "#0d1a0d",
                    opacity: 0.7,
                    cursor: "not-allowed",
                  }}
                  disabled
                >
                  Stake HERO (Coming Soon)
                </button>
              </>
            )}

            {activeTab === "unstake" && (
              <>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: "#8a9a8a" }}>
                    Amount to Unstake
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={unstakeAmount}
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                      className="bg-black/30 border-[#3D5A3D] text-white"
                    />
                    <button
                      className="px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(200,168,75,0.15)", color: "#C8A84B", border: "1px solid rgba(200,168,75,0.3)" }}
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div
                  className="rounded-lg p-3 text-xs"
                  style={{ background: "rgba(224,90,90,0.08)", border: "1px solid rgba(224,90,90,0.2)" }}
                >
                  <p style={{ color: "#e05a5a" }}>
                    ⚠️ Early unstaking within the 7-day lock period incurs a 10% penalty on your staked
                    HERO. Penalty goes to the protocol treasury.
                  </p>
                </div>
                <button
                  onClick={handleUnstake}
                  className="w-full py-3 rounded-xl font-bold text-base transition-all"
                  style={{
                    background: "rgba(224,90,90,0.15)",
                    border: "1px solid rgba(224,90,90,0.3)",
                    color: "#e05a5a",
                    opacity: 0.7,
                    cursor: "not-allowed",
                  }}
                  disabled
                >
                  Unstake HERO (Coming Soon)
                </button>
              </>
            )}

            {activeTab === "rewards" && (
              <>
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ background: "rgba(200,168,75,0.08)", border: "1px solid rgba(200,168,75,0.2)" }}
                >
                  <p className="text-xs mb-1" style={{ color: "#8a9a8a" }}>Pending DAI Rewards</p>
                  <p className="text-3xl font-bold" style={{ color: "#C8A84B" }}>
                    {MOCK_STATS.pendingRewards}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#5a6a5a" }}>DAI Stablecoin</p>
                </div>
                <button
                  onClick={handleClaim}
                  className="w-full py-3 rounded-xl font-bold text-base transition-all"
                  style={{
                    background: "linear-gradient(135deg, #C8A84B, #a8882b)",
                    color: "#0d1a0d",
                    opacity: 0.7,
                    cursor: "not-allowed",
                  }}
                  disabled
                >
                  Claim DAI Rewards (Coming Soon)
                </button>
                <p className="text-center text-xs" style={{ color: "#5a6a5a" }}>
                  Rewards accrue in real-time. Claim anytime with no penalty.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info footer */}
      <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: "#5a6a5a" }}>
        <Info className="w-3 h-3" />
        <span>
          HERO CA on BASE:{" "}
          <a
            href={`https://basescan.org/token/${HERO_BASE_CA}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: "#C8A84B", fontFamily: "monospace" }}
          >
            {HERO_BASE_CA.slice(0, 10)}...{HERO_BASE_CA.slice(-6)}
          </a>
        </span>
        <ExternalLink className="w-3 h-3" />
      </div>
    </div>
  );
}
