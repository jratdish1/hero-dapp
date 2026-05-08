import { useState, useMemo } from "react";
import { Clock, Download, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "herobase_swap_history";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SwapRecord {
  id: string;
  timestamp: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  dex: string;
  priceImpact: number;
  chain: "pulsechain" | "base";
  txHash?: string;
}

// ─── Helpers (outside component) ──────────────────────────────────────────────
function getSwapHistory(): SwapRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    // Basic shape validation
    return parsed.filter(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "timestamp" in item &&
        "fromToken" in item
    ) as SwapRecord[];
  } catch {
    return [];
  }
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function getExplorerUrl(hash: string, chain: "pulsechain" | "base"): string {
  return chain === "pulsechain"
    ? `https://scan.pulsechain.com/tx/${hash}`
    : `https://basescan.org/tx/${hash}`;
}

function impactColor(impact: number): string {
  if (impact < 0.01) return "text-green-400";
  if (impact < 0.03) return "text-yellow-400";
  if (impact < 0.05) return "text-orange-400";
  return "text-red-400";
}

function escapeCsv(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_SWAPS: SwapRecord[] = [
  {
    id: "demo-1",
    timestamp: Date.now() - 3600000,
    fromToken: "PLS",
    toToken: "HERO",
    fromAmount: "5,000,000",
    toAmount: "184,605",
    dex: "PulseX V2",
    priceImpact: 0.002,
    chain: "pulsechain",
    txHash: "0x1234...abcd",
  },
  {
    id: "demo-2",
    timestamp: Date.now() - 7200000,
    fromToken: "HERO",
    toToken: "VETS",
    fromAmount: "100,000",
    toAmount: "3,925",
    dex: "SquirrelSwap",
    priceImpact: 0.008,
    chain: "pulsechain",
    txHash: "0x5678...efgh",
  },
  {
    id: "demo-3",
    timestamp: Date.now() - 14400000,
    fromToken: "PLS",
    toToken: "EMIT",
    fromAmount: "2,000,000",
    toAmount: "45,320",
    dex: "9inch",
    priceImpact: 0.015,
    chain: "pulsechain",
    txHash: "0x9abc...ijkl",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function SwapHistory() {
  const { isPulseChain } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);

  // Get history from localStorage or use demo data
  const history = useMemo(() => {
    const stored = getSwapHistory();
    return stored.length > 0 ? stored : DEMO_SWAPS;
  }, []);

  // Filter by active chain
  const filteredHistory = useMemo(() => {
    const chain = isPulseChain ? "pulsechain" : "base";
    return history.filter((s) => s.chain === chain);
  }, [history, isPulseChain]);

  const handleExport = () => {
    if (filteredHistory.length === 0) return;

    const headers = "Date,From,To,From Amount,To Amount,DEX,Price Impact,Chain,TX Hash";
    const rows = filteredHistory.map((s) =>
      [
        new Date(s.timestamp).toISOString(),
        escapeCsv(s.fromToken),
        escapeCsv(s.toToken),
        escapeCsv(s.fromAmount),
        escapeCsv(s.toAmount),
        escapeCsv(s.dex),
        `${(s.priceImpact * 100).toFixed(2)}%`,
        s.chain,
        s.txHash || "",
      ].join(",")
    );

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `herobase_swaps_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="swap-history-panel"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Swap History</span>
          {filteredHistory.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--hero-green)]/10 text-[var(--hero-green)] font-medium">
              {filteredHistory.length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* History panel */}
      {isOpen && (
        <div id="swap-history-panel" className="px-4 pb-4 space-y-3 border-t border-border/50">
          {/* Export button */}
          {filteredHistory.length > 0 && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleExport}
                aria-label="Export swap history as CSV"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            </div>
          )}

          {/* Swap records */}
          {filteredHistory.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No swaps yet on this chain</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.slice(0, 10).map((swap) => (
                <div
                  key={swap.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/20 border border-border/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <div className="text-xs font-medium text-foreground">
                        {swap.fromToken} → {swap.toToken}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {swap.fromAmount} → {swap.toAmount}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">{swap.dex}</div>
                      <span className={`text-[10px] font-mono ${impactColor(swap.priceImpact)}`}>
                        {(swap.priceImpact * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">{formatTime(swap.timestamp)}</div>
                      {swap.txHash && (
                        <a
                          href={getExplorerUrl(swap.txHash, swap.chain)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View transaction ${swap.txHash} on block explorer`}
                          className="inline-flex items-center gap-0.5 text-[10px] text-[var(--hero-green)] hover:underline"
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
