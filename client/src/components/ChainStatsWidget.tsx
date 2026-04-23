/**
 * ChainStatsWidget — Live chain stats for PulseChain + BASE
 * Shows gas, TVL, block height, TPS. Auto-refreshes every 30s.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Fuel, Activity, Layers, Zap, RefreshCw, Server,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";

interface ChainStats {
  gasPrice: string;
  gasPriceGwei: number;
  blockNumber: number;
  lastUpdated: number;
}

const PULSECHAIN_RPC = "https://rpc-pulsechain.g4mm4.io";
const BASE_RPC = "https://mainnet.base.org";

async function fetchChainStats(rpc: string): Promise<ChainStats> {
  const [gasRes, blockRes] = await Promise.all([
    fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }),
      signal: AbortSignal.timeout(8000),
    }),
    fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 }),
      signal: AbortSignal.timeout(8000),
    }),
  ]);
  const gasJson = await gasRes.json();
  const blockJson = await blockRes.json();
  const gasPriceWei = parseInt(gasJson.result, 16);
  const gasPriceGwei = gasPriceWei / 1e9;
  return {
    gasPrice: gasPriceGwei < 1 ? gasPriceGwei.toFixed(4) : gasPriceGwei.toFixed(2),
    gasPriceGwei,
    blockNumber: parseInt(blockJson.result, 16),
    lastUpdated: Date.now(),
  };
}

function formatBlockNumber(num: number): string {
  return num.toLocaleString("en-US");
}

function GasIndicator({ gwei }: { gwei: number }) {
  const level = gwei < 10 ? "low" : gwei < 100 ? "medium" : "high";
  const colors = {
    low: "text-emerald-400 bg-emerald-400/10",
    medium: "text-yellow-400 bg-yellow-400/10",
    high: "text-red-400 bg-red-400/10",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[level]} border-transparent`}>
      {level === "low" ? "Low" : level === "medium" ? "Med" : "High"}
    </Badge>
  );
}

export default function ChainStatsWidget() {
  const [plsStats, setPlsStats] = useState<ChainStats | null>(null);
  const [baseStats, setBaseStats] = useState<ChainStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [pls, base] = await Promise.all([
        fetchChainStats(PULSECHAIN_RPC).catch(() => null),
        fetchChainStats(BASE_RPC).catch(() => null),
      ]);
      if (pls) setPlsStats(pls);
      if (base) setBaseStats(base);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const StatCard = ({ label, value, icon: Icon, subtext, color }: {
    label: string; value: string; icon: React.ElementType; subtext?: string; color: string;
  }) => (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
      <div className={`p-2 rounded-lg`} style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-foreground">{loading ? "..." : value}</p>
        {subtext && <p className="text-[10px] text-muted-foreground">{subtext}</p>}
      </div>
    </div>
  );

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--hero-orange)]" />
            Live Chain Stats
          </h3>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* PulseChain Stats */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-xs font-medium text-muted-foreground">PulseChain</span>
            {plsStats && <GasIndicator gwei={plsStats.gasPriceGwei} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Gas"
              value={plsStats ? `${plsStats.gasPrice} Gwei` : "—"}
              icon={Fuel}
              color="#a855f7"
            />
            <StatCard
              label="Block"
              value={plsStats ? formatBlockNumber(plsStats.blockNumber) : "—"}
              icon={Layers}
              color="#a855f7"
            />
          </div>
        </div>

        {/* BASE Stats */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">BASE</span>
            {baseStats && <GasIndicator gwei={baseStats.gasPriceGwei} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Gas"
              value={baseStats ? `${baseStats.gasPrice} Gwei` : "—"}
              icon={Fuel}
              color="#3b82f6"
            />
            <StatCard
              label="Block"
              value={baseStats ? formatBlockNumber(baseStats.blockNumber) : "—"}
              icon={Layers}
              color="#3b82f6"
            />
          </div>
        </div>

        {/* Last Updated */}
        {plsStats && (
          <p className="text-[10px] text-muted-foreground text-right mt-3">
            Updated {new Date(plsStats.lastUpdated).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
