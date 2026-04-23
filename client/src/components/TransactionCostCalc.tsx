/**
 * TransactionCostCalc — Real-time gas cost estimates for common operations
 * Fetches current gas price from PulseChain + BASE RPCs and calculates costs.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeftRight, Plus, Minus, Shield, Send, Fuel,
  RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";

interface TxCost {
  name: string;
  gasUnits: number;
  icon: React.ElementType;
  description: string;
}

const TX_TYPES: TxCost[] = [
  { name: "Token Swap", gasUnits: 180000, icon: ArrowLeftRight, description: "Swap one token for another via DEX" },
  { name: "Add Liquidity", gasUnits: 250000, icon: Plus, description: "Add tokens to a liquidity pool" },
  { name: "Remove Liquidity", gasUnits: 200000, icon: Minus, description: "Remove tokens from a liquidity pool" },
  { name: "Token Approval", gasUnits: 46000, icon: Shield, description: "Approve a contract to spend your tokens" },
  { name: "Token Transfer", gasUnits: 65000, icon: Send, description: "Send tokens to another wallet" },
];

const PULSECHAIN_RPC = "https://rpc-pulsechain.g4mm4.io";
const BASE_RPC = "https://mainnet.base.org";

async function getGasPrice(rpc: string): Promise<number> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 }),
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json();
  return parseInt(json.result, 16);
}

export default function TransactionCostCalc() {
  const [plsGasWei, setPlsGasWei] = useState<number | null>(null);
  const [baseGasWei, setBaseGasWei] = useState<number | null>(null);
  const [plsPrice, setPlsPrice] = useState<number>(0.0000078); // fallback
  const [ethPrice, setEthPrice] = useState<number>(2300); // fallback
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [plsGas, baseGas] = await Promise.all([
        getGasPrice(PULSECHAIN_RPC).catch(() => null),
        getGasPrice(BASE_RPC).catch(() => null),
      ]);
      if (plsGas) setPlsGasWei(plsGas);
      if (baseGas) setBaseGasWei(baseGas);

      // Fetch PLS and ETH prices from DexScreener
      try {
        const [plsRes, ethRes] = await Promise.all([
          fetch("https://api.dexscreener.com/latest/dex/tokens/0xA1077a294dDE1B09bB078844df40758a5D0f9a27", { signal: AbortSignal.timeout(8000) }),
          fetch("https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006", { signal: AbortSignal.timeout(8000) }),
        ]);
        const plsData = await plsRes.json();
        const ethData = await ethRes.json();
        if (plsData.pairs?.[0]?.priceUsd) setPlsPrice(parseFloat(plsData.pairs[0].priceUsd));
        if (ethData.pairs?.[0]?.priceUsd) setEthPrice(parseFloat(ethData.pairs[0].priceUsd));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const calcCost = (gasUnits: number, gasWei: number | null, nativePrice: number) => {
    if (!gasWei) return { native: "—", usd: "—" };
    const costWei = gasUnits * gasWei;
    const costNative = costWei / 1e18;
    const costUsd = costNative * nativePrice;
    return {
      native: costNative < 1 ? costNative.toFixed(4) : costNative.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      usd: costUsd < 0.01 ? `$${costUsd.toFixed(6)}` : `$${costUsd.toFixed(4)}`,
    };
  };

  const displayTxTypes = expanded ? TX_TYPES : TX_TYPES.slice(0, 3);

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Fuel className="w-4 h-4 text-[var(--hero-orange)]" />
            Transaction Costs
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Current Gas:</span>
            <span className="text-purple-400 font-medium">
              {plsGasWei ? `${(plsGasWei / 1e9).toFixed(0)} gwei` : "..."}
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span className="text-blue-400 font-medium">
              {baseGasWei ? `${(baseGasWei / 1e9).toFixed(4)} gwei` : "..."}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wider px-2">
            <span>Operation</span>
            <span className="text-right">PulseChain</span>
            <span className="text-right">BASE</span>
          </div>

          {/* Rows */}
          {displayTxTypes.map(tx => {
            const Icon = tx.icon;
            const plsCost = calcCost(tx.gasUnits, plsGasWei, plsPrice);
            const baseCost = calcCost(tx.gasUnits, baseGasWei, ethPrice);
            return (
              <div
                key={tx.name}
                className="grid grid-cols-[1fr_80px_80px] gap-2 items-center px-2 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                title={tx.description}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground truncate">{tx.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-purple-400">{loading ? "..." : plsCost.usd}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-blue-400">{loading ? "..." : baseCost.usd}</p>
                </div>
              </div>
            );
          })}
        </div>

        {TX_TYPES.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            {expanded ? (
              <>Show Less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Show All ({TX_TYPES.length}) <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
