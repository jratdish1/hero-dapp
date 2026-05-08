import { useState, useEffect } from "react";
import { History, ExternalLink, Download, Trash2, ArrowRight } from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";

interface SwapRecord {
  id: string;
  timestamp: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  dex: string;
  txHash?: string;
  priceImpact: number;
  chain: "pulsechain" | "base";
}

const STORAGE_KEY = "hero_swap_history";

function getSwapHistory(): SwapRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function clearSwapHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

// Demo data for display (in production, these would be populated from wallet events)
const DEMO_SWAPS: SwapRecord[] = [
  {
    id: "1",
    timestamp: Date.now() - 3600000,
    fromToken: "PLS",
    toToken: "HERO",
    fromAmount: "500,000",
    toAmount: "2,463,054",
    dex: "PulseX V2",
    txHash: "0x1a2b3c...4d5e6f",
    priceImpact: 0.42,
    chain: "pulsechain",
  },
  {
    id: "2",
    timestamp: Date.now() - 86400000,
    fromToken: "HERO",
    toToken: "VETS",
    fromAmount: "1,000,000",
    toAmount: "39,200",
    dex: "9inch",
    txHash: "0x7a8b9c...0d1e2f",
    priceImpact: 1.23,
    chain: "pulsechain",
  },
  {
    id: "3",
    timestamp: Date.now() - 172800000,
    fromToken: "PLS",
    toToken: "EMIT",
    fromAmount: "2,000,000",
    toAmount: "847,291",
    dex: "PulseX V1",
    txHash: "0x3f4g5h...6i7j8k",
    priceImpact: 0.87,
    chain: "pulsechain",
  },
  {
    id: "4",
    timestamp: Date.now() - 259200000,
    fromToken: "USDC",
    toToken: "HERO",
    fromAmount: "50",
    toAmount: "246,305",
    dex: "Uniswap V3",
    txHash: "0x9l0m1n...2o3p4q",
    priceImpact: 0.15,
    chain: "base",
  },
];

export default function SwapHistory() {
  const { isPulseChain, chain } = useNetwork();
  const [history, setHistory] = useState<SwapRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const saved = getSwapHistory();
    // Merge with demo data if no real history
    setHistory(saved.length > 0 ? saved : DEMO_SWAPS);
  }, []);

  const filteredHistory = history.filter(s => 
    isPulseChain ? s.chain === "pulsechain" : s.chain === "base"
  );

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getExplorerUrl = (hash: string, chain: "pulsechain" | "base") => {
    if (chain === "base") return `https://basescan.org/tx/${hash}`;
    return `https://scan.pulsechain.com/tx/${hash}`;
  };

  const handleExport = () => {
    const csv = [
      "Date,From,To,From Amount,To Amount,DEX,Price Impact,Chain,TX Hash",
      ...filteredHistory.map(s => 
        `${new Date(s.timestamp).toISOString()},${s.fromToken},${s.toToken},${s.fromAmount},${s.toAmount},${s.dex},${s.priceImpact}%,${s.chain},${s.txHash || ""}`
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swap_history_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    clearSwapHistory();
    setHistory([]);
  };

  const impactColor = (impact: number) => {
    if (impact < 1) return "text-green-400";
    if (impact < 3) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Swap History</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {filteredHistory.length}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* History list */}
      {isOpen && (
        <div className="border-t border-border/50">
          {/* Actions */}
          <div className="flex items-center justify-between px-4 py-2 bg-secondary/20">
            <span className="text-xs text-muted-foreground">
              Showing {filteredHistory.length} swaps on {isPulseChain ? "PulseChain" : "BASE"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>
          </div>

          {/* Swap records */}
          <div className="max-h-[300px] overflow-y-auto">
            {filteredHistory.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <History className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No swap history yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Your swaps will appear here after you trade</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredHistory.map(swap => (
                  <div key={swap.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground">{swap.fromAmount} {swap.fromToken}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-[var(--hero-green)]">{swap.toAmount} {swap.toToken}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono ${impactColor(swap.priceImpact)}`}>
                          {swap.priceImpact.toFixed(2)}%
                        </span>
                        {swap.txHash && (
                          <a
                            href={getExplorerUrl(swap.txHash, swap.chain)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">{swap.dex}</span>
                      <span className="text-[10px] text-muted-foreground">•</span>
                      <span className="text-[10px] text-muted-foreground">{formatTime(swap.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
