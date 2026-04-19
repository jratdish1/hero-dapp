import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot,
  Activity,
  TrendingUp,
  Zap,
  Shield,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Fuel,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

interface BotStats {
  chain: string;
  chainIcon: string;
  contractAddress: string;
  heroGained: string;
  heroInContract: string;
  rewardsDistributed: string;
  gasBalance: string;
  gasUnit: string;
  status: "online" | "scanning" | "offline";
  lastTrade: string;
  tradesExecuted: number;
  uptime: string;
  pairs: string[];
}

const PULSE_BOT: BotStats = {
  chain: "PulseChain",
  chainIcon: "💜",
  contractAddress: "0xC24c...e151",
  heroGained: "348,321",
  heroInContract: "506,244",
  rewardsDistributed: "173,272",
  gasBalance: "16.2M",
  gasUnit: "PLS",
  status: "scanning",
  lastTrade: "Scanning for opportunities...",
  tradesExecuted: 47,
  uptime: "99.7%",
  pairs: ["HERO/WPLS", "HERO/DAI", "HERO/USDC", "HERO/USDT", "HERO/HEX", "HERO/PLSX", "HERO/INC"],
};

const BASE_BOT: BotStats = {
  chain: "BASE",
  chainIcon: "🔵",
  contractAddress: "0xae55...5423",
  heroGained: "2,008",
  heroInContract: "375,769",
  rewardsDistributed: "1,004",
  gasBalance: "0.0001",
  gasUnit: "ETH",
  status: "offline",
  lastTrade: "Low gas — needs ETH refill",
  tradesExecuted: 12,
  uptime: "87.3%",
  pairs: ["HERO/WETH", "HERO/USDC", "HERO/cbBTC", "HERO/DAI", "HERO/AERO", "HERO/BRETT"],
};

function StatusBadge({ status }: { status: BotStats["status"] }) {
  const config = {
    online: { icon: CheckCircle2, label: "ONLINE", color: "text-emerald-400 bg-emerald-500/20" },
    scanning: { icon: Activity, label: "SCANNING", color: "text-[var(--hero-green)] bg-[var(--hero-green)]/20" },
    offline: { icon: XCircle, label: "OFFLINE", color: "text-red-400 bg-red-500/20" },
  };
  const { icon: Icon, label, color } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function BotCard({ bot }: { bot: BotStats }) {
  const [pulseAnim, setPulseAnim] = useState(false);

  useEffect(() => {
    if (bot.status === "scanning") {
      const interval = setInterval(() => {
        setPulseAnim((p) => !p);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [bot.status]);

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-xl">{bot.chainIcon}</span>
            {bot.chain} ABLE Bot
          </CardTitle>
          <StatusBadge status={bot.status} />
        </div>
        <p className="text-xs text-muted-foreground font-mono mt-1">
          Contract: {bot.contractAddress}
          <span className="ml-2 text-emerald-400/60">● Fee Exempt</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--hero-green)]" />
              <span className="text-xs text-muted-foreground">HERO Gained</span>
            </div>
            <p className="text-lg font-bold text-[var(--hero-green)]">{bot.heroGained}</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-[var(--hero-orange)]" />
              <span className="text-xs text-muted-foreground">In Contract</span>
            </div>
            <p className="text-lg font-bold text-foreground">{bot.heroInContract}</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-muted-foreground">Rewards Paid</span>
            </div>
            <p className="text-lg font-bold text-amber-400">{bot.rewardsDistributed}</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Fuel className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-muted-foreground">Gas Balance</span>
            </div>
            <p className={`text-lg font-bold ${parseFloat(bot.gasBalance.replace(/[,M]/g, "")) < 1 ? "text-red-400" : "text-foreground"}`}>
              {bot.gasBalance} <span className="text-xs font-normal text-muted-foreground">{bot.gasUnit}</span>
            </p>
            {parseFloat(bot.gasBalance.replace(/[,M]/g, "")) < 1 && (
              <p className="text-[10px] text-red-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3" /> Needs refill
              </p>
            )}
          </div>
        </div>

        {/* Activity */}
        <div className="flex items-center justify-between py-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${bot.status === "scanning" ? "bg-[var(--hero-green)] animate-pulse" : bot.status === "online" ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="text-xs text-muted-foreground">{bot.lastTrade}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" /> {bot.tradesExecuted} trades
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {bot.uptime}
            </span>
          </div>
        </div>

        {/* Monitored Pairs */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Monitored Pairs</p>
          <div className="flex flex-wrap gap-1.5">
            {bot.pairs.map((pair) => (
              <span
                key={pair}
                className="px-2 py-0.5 text-[10px] font-medium rounded bg-secondary text-muted-foreground"
              >
                {pair}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AbleBots() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
    }, 1000);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-[var(--hero-green)]" />
            HERO ABLE Bots
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated arbitrage bots monitoring HERO liquidity pools across chains
            <span className="text-xs opacity-60 ml-2">
              · Updated {lastUpdated.toLocaleTimeString()}
            </span>
          </p>
        </div>
        <button
          onClick={refresh}
          className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total HERO Gained</p>
            <p className="text-xl font-bold text-[var(--hero-green)]">350,329</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Rewards Paid</p>
            <p className="text-xl font-bold text-amber-400">174,276</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Active Bots</p>
            <p className="text-xl font-bold text-foreground">1 / 2</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Pairs Monitored</p>
            <p className="text-xl font-bold text-foreground">13</p>
          </CardContent>
        </Card>
      </div>

      {/* Bot Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BotCard bot={PULSE_BOT} />
        <BotCard bot={BASE_BOT} />
      </div>

      {/* How It Works */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--hero-green)]" />
            How ABLE Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
              <div className="w-8 h-8 rounded-full bg-[var(--hero-green)]/20 flex items-center justify-center mb-3">
                <Activity className="w-4 h-4 text-[var(--hero-green)]" />
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Monitor</h4>
              <p className="text-xs text-muted-foreground">
                Continuously scans HERO LP pools for price discrepancies between trading pairs.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
              <div className="w-8 h-8 rounded-full bg-[var(--hero-orange)]/20 flex items-center justify-center mb-3">
                <Zap className="w-4 h-4 text-[var(--hero-orange)]" />
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Execute</h4>
              <p className="text-xs text-muted-foreground">
                When a profitable spread is detected, the bot executes atomic arbitrage via smart contract.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center mb-3">
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Distribute</h4>
              <p className="text-xs text-muted-foreground">
                Profits are accumulated in the contract and distributed as HERO rewards to the ecosystem.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/60 text-center">
        ABLE bots are fee-exempt smart contracts that help maintain healthy liquidity across HERO pools.
        Bot statistics update every 5 minutes. Past performance does not guarantee future results.
      </p>
    </div>
  );
}
