import { useState, useEffect, useMemo } from "react";
import { Clock, ExternalLink, ArrowUpRight, ArrowDownRight, Filter, Download, RefreshCw, Search } from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";
import { useAccount } from "wagmi";

// ─── Constants ────────────────────────────────────────────────────────────────
const TX_STORAGE_KEY = "herobase_tx_history";
const PULSECHAIN_EXPLORER = "https://scan.pulsechain.com";
const BASE_EXPLORER = "https://basescan.org";
const DEXSCREENER_BASE = "https://dexscreener.com";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
  hash: string;
  type: "swap" | "transfer" | "approve" | "stake" | "unstake" | "claim" | "bridge" | "lp_add" | "lp_remove";
  from: string;
  to: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  amountOut?: string;
  valueUsd?: number;
  timestamp: number;
  status: "success" | "failed" | "pending";
  gasUsed?: string;
  chain: "pulsechain" | "base";
  dex?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStoredTransactions(): Transaction[] {
  try {
    const data = localStorage.getItem(TX_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function shortenHash(hash: string): string {
  return hash ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : "";
}

function shortenAddress(addr: string): string {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function getTypeLabel(type: Transaction["type"]): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    swap: { label: "Swap", color: "text-blue-400 bg-blue-400/10" },
    transfer: { label: "Transfer", color: "text-purple-400 bg-purple-400/10" },
    approve: { label: "Approve", color: "text-yellow-400 bg-yellow-400/10" },
    stake: { label: "Stake", color: "text-green-400 bg-green-400/10" },
    unstake: { label: "Unstake", color: "text-orange-400 bg-orange-400/10" },
    claim: { label: "Claim", color: "text-emerald-400 bg-emerald-400/10" },
    bridge: { label: "Bridge", color: "text-cyan-400 bg-cyan-400/10" },
    lp_add: { label: "Add LP", color: "text-green-400 bg-green-400/10" },
    lp_remove: { label: "Remove LP", color: "text-red-400 bg-red-400/10" },
  };
  return map[type] || { label: type, color: "text-muted-foreground bg-secondary" };
}

function escapeCsv(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_TRANSACTIONS: Transaction[] = [
  {
    hash: "0xa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
    type: "swap",
    from: "0x1234...5678",
    to: "PulseX V2",
    tokenIn: "PLS",
    tokenOut: "HERO",
    amountIn: "5,000,000",
    amountOut: "184,605",
    valueUsd: 37.45,
    timestamp: Date.now() - 1800000,
    status: "success",
    gasUsed: "0.003 PLS",
    chain: "pulsechain",
    dex: "PulseX V2",
  },
  {
    hash: "0xb2c3d4e5f67890123456789012345678901234567890abcdef1234567890abcd",
    type: "swap",
    from: "0x1234...5678",
    to: "SquirrelSwap",
    tokenIn: "HERO",
    tokenOut: "VETS",
    amountIn: "100,000",
    amountOut: "3,925",
    valueUsd: 20.30,
    timestamp: Date.now() - 5400000,
    status: "success",
    gasUsed: "0.005 PLS",
    chain: "pulsechain",
    dex: "SquirrelSwap",
  },
  {
    hash: "0xc3d4e5f6789012345678901234567890123456789012345678901234567890ab",
    type: "stake",
    from: "0x1234...5678",
    to: "HERO Staking",
    tokenIn: "HERO",
    amountIn: "500,000",
    valueUsd: 101.50,
    timestamp: Date.now() - 86400000,
    status: "success",
    gasUsed: "0.008 PLS",
    chain: "pulsechain",
  },
  {
    hash: "0xd4e5f67890123456789012345678901234567890123456789012345678901234",
    type: "approve",
    from: "0x1234...5678",
    to: "PulseX Router",
    tokenIn: "HERO",
    amountIn: "Unlimited",
    timestamp: Date.now() - 90000000,
    status: "success",
    gasUsed: "0.001 PLS",
    chain: "pulsechain",
  },
  {
    hash: "0xe5f678901234567890123456789012345678901234567890123456789012345a",
    type: "bridge",
    from: "0x1234...5678",
    to: "Liberty Swap",
    tokenIn: "USDC",
    tokenOut: "USDC",
    amountIn: "500",
    amountOut: "498.50",
    valueUsd: 500,
    timestamp: Date.now() - 172800000,
    status: "success",
    gasUsed: "0.012 PLS",
    chain: "pulsechain",
    dex: "Liberty Swap",
  },
  {
    hash: "0xf6789012345678901234567890123456789012345678901234567890123456ab",
    type: "claim",
    from: "HERO Staking",
    to: "0x1234...5678",
    tokenOut: "HERO",
    amountOut: "12,500",
    valueUsd: 2.54,
    timestamp: Date.now() - 259200000,
    status: "success",
    gasUsed: "0.004 PLS",
    chain: "pulsechain",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TransactionHistory() {
  const { isPulseChain } = useNetwork();
  const { address } = useAccount();
  const [filter, setFilter] = useState<"all" | Transaction["type"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (isRefreshing) {
      timeout = setTimeout(() => setIsRefreshing(false), 1500);
    }
    return () => clearTimeout(timeout);
  }, [isRefreshing]);

  // Get transactions (stored + demo)
  const allTransactions = useMemo(() => {
    const stored = getStoredTransactions();
    return stored.length > 0 ? stored : DEMO_TRANSACTIONS;
  }, []);

  // Filter by chain and type
  const filteredTxs = useMemo(() => {
    const chain = isPulseChain ? "pulsechain" : "base";
    return allTransactions
      .filter((tx) => tx.chain === chain)
      .filter((tx) => filter === "all" || tx.type === filter)
      .filter((tx) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          tx.hash.toLowerCase().includes(q) ||
          (tx.tokenIn?.toLowerCase().includes(q) ?? false) ||
          (tx.tokenOut?.toLowerCase().includes(q) ?? false) ||
          (tx.dex?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [allTransactions, isPulseChain, filter, searchQuery]);

  const explorer = isPulseChain ? PULSECHAIN_EXPLORER : BASE_EXPLORER;
  const chainSlug = isPulseChain ? "pulsechain" : "base";

  const handleExport = () => {
    if (filteredTxs.length === 0) return;
    const headers = "Date,Type,Token In,Amount In,Token Out,Amount Out,Value USD,DEX,Status,TX Hash,Explorer Link";
    const rows = filteredTxs.map((tx) =>
      [
        new Date(tx.timestamp).toISOString(),
        tx.type,
        escapeCsv(tx.tokenIn || ""),
        escapeCsv(tx.amountIn || ""),
        escapeCsv(tx.tokenOut || ""),
        escapeCsv(tx.amountOut || ""),
        tx.valueUsd?.toFixed(2) || "",
        escapeCsv(tx.dex || ""),
        tx.status,
        tx.hash,
        `${explorer}/tx/${tx.hash}`,
      ].join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `herobase_transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeFilters: { value: "all" | Transaction["type"]; label: string }[] = [
    { value: "all", label: "All" },
    { value: "swap", label: "Swaps" },
    { value: "transfer", label: "Transfers" },
    { value: "stake", label: "Stakes" },
    { value: "claim", label: "Claims" },
    { value: "bridge", label: "Bridges" },
    { value: "approve", label: "Approvals" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-[var(--hero-green)]" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Transaction History</h2>
            <p className="text-xs text-muted-foreground">{filteredTxs.length} transactions • {isPulseChain ? "PulseChain" : "BASE"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRefreshing(true)}
            aria-label="Refresh transactions"
            className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleExport}
            aria-label="Export transactions as CSV"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by hash, token, or DEX..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--hero-green)]/50"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3 h-3 text-muted-foreground" />
          {typeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filter === f.value
                  ? "bg-[var(--hero-green)]/20 text-[var(--hero-green)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      {filteredTxs.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTxs.map((tx) => {
            const typeInfo = getTypeLabel(tx.type);
            return (
              <div
                key={tx.hash}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 transition-colors"
              >
                {/* Left: Type + tokens */}
                <div className="flex items-center gap-3">
                  <div className={`px-2 py-0.5 rounded text-[10px] font-medium ${typeInfo.color}`}>
                    {typeInfo.label}
                  </div>
                  <div>
                    {tx.tokenIn && tx.tokenOut ? (
                      <div className="text-sm text-foreground">
                        <span className="font-medium">{tx.amountIn} {tx.tokenIn}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span className="font-medium">{tx.amountOut} {tx.tokenOut}</span>
                      </div>
                    ) : tx.tokenIn ? (
                      <div className="text-sm text-foreground">
                        <span className="font-medium">{tx.amountIn} {tx.tokenIn}</span>
                      </div>
                    ) : tx.tokenOut ? (
                      <div className="text-sm text-foreground">
                        <span className="font-medium">+{tx.amountOut} {tx.tokenOut}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {tx.dex && <span>{tx.dex}</span>}
                      {tx.valueUsd && tx.valueUsd > 0 && <span>≈ ${tx.valueUsd.toFixed(2)}</span>}
                    </div>
                  </div>
                </div>

                {/* Right: Time + links */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">{formatTimeAgo(tx.timestamp)}</div>
                    <div className={`text-[10px] ${tx.status === "success" ? "text-green-400" : tx.status === "failed" ? "text-red-400" : "text-yellow-400"}`}>
                      {tx.status}
                    </div>
                  </div>
                  <a
                    href={`${explorer}/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View transaction on ${isPulseChain ? "PulseScan" : "BaseScan"}`}
                    className="p-1 rounded hover:bg-secondary/50 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-[var(--hero-green)]" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Explorer link */}
      {address && (
        <div className="text-center pt-2">
          <a
            href={`${explorer}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--hero-green)] hover:underline"
          >
            View all on {isPulseChain ? "PulseScan" : "BaseScan"} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
