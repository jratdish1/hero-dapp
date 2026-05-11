/**
 * TreasuryDisplay — Shows real-time treasury balance for PulseChain + BASE
 * Address: 0x94e52915b99ffdd298939f9e0b4a7af80e6789f7
 * Displays native token balance (PLS / ETH) side by side
 * Note: Funds donated to quarterly DAO vote winner
 */
import { useState, useEffect, useCallback } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import { Wallet, RefreshCw, Vote } from "lucide-react";

const TREASURY_ADDRESS = "0x94e52915b99ffdd298939f9e0b4a7af80e6789f7";

// RPC endpoints
const PLS_RPC = "https://rpc.pulsechain.com";
const BASE_RPC = "https://mainnet.base.org";
// Stablecoin addresses
const DAI_PLS = "0xefD766cCb38EaF1dfd701853BFCe31359239F305"; // DAI on PulseChain
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base

interface TreasuryBalance {
  pls: string;
  eth: string;
  daiPls: string;
  usdcBase: string;
  loading: boolean;
  error: string | null;
}

async function getBalance(rpc: string, address: string): Promise<string> {
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
    });
    const data = await res.json();
    if (data.result) {
      const wei = BigInt(data.result);
      const whole = wei / BigInt(10 ** 18);
      const fraction = (wei % BigInt(10 ** 18)).toString().padStart(18, "0").slice(0, 4);
      return `${whole.toLocaleString()}.${fraction}`;
    }
    return "0";
  } catch {
    return "Error";
  }
}

async function getErc20Balance(rpc: string, tokenAddress: string, walletAddress: string, decimals: number): Promise<string> {
  try {
    const data = "0x70a08231" + walletAddress.slice(2).padStart(64, "0");
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: tokenAddress, data }, "latest"],
        id: 1,
      }),
    });
    const result = await res.json();
    if (result.result && result.result !== "0x") {
      const wei = BigInt(result.result);
      const divisor = BigInt(10 ** decimals);
      const whole = wei / divisor;
      const fraction = (wei % divisor).toString().padStart(decimals, "0").slice(0, 2);
      return whole.toLocaleString() + "." + fraction;
    }
    return "0.00";
  } catch {
    return "Error";
  }
}

export default function TreasuryDisplay() {
  const [balances, setBalances] = useState<TreasuryBalance>({
    pls: "...",
    eth: "...",
    daiPls: "...",
    usdcBase: "...",
    loading: true,
    error: null,
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchBalances = useCallback(async () => {
    setRefreshing(true);
    try {
      const [plsBal, ethBal, daiPls, usdcBase] = await Promise.all([
        getBalance(PLS_RPC, TREASURY_ADDRESS),
        getBalance(BASE_RPC, TREASURY_ADDRESS),
        getErc20Balance(PLS_RPC, DAI_PLS, TREASURY_ADDRESS, 18),
        getErc20Balance(BASE_RPC, USDC_BASE, TREASURY_ADDRESS, 6),
      ]);
      setBalances({ pls: plsBal, eth: ethBal, daiPls, usdcBase, loading: false, error: null });
    } catch (err) {
      setBalances((prev) => ({ ...prev, loading: false, error: "Failed to fetch" }));
    }
    if (mountedRef.current) setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchBalances]);

  return (
    <div className="rounded-xl border border-[var(--hero-orange)]/30 bg-card/80 backdrop-blur-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[var(--hero-orange)]" />
          <h3 className="font-bold text-sm text-foreground">Community Treasury</h3>
        </div>
        <button
          onClick={fetchBalances}
          disabled={refreshing}
          className="p-1.5 rounded-md hover:bg-accent/50 transition-colors"
          aria-label="Refresh treasury balances"
          type="button"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Address */}
      <p className="text-[10px] font-mono text-muted-foreground mb-3 truncate">
        {TREASURY_ADDRESS}
      </p>

      {/* Balances side by side */}
      <div className="grid grid-cols-2 gap-3">
        {/* PulseChain */}
        <div className="rounded-lg bg-background/60 p-3 border border-green-500/20">
          <p className="text-[10px] uppercase tracking-wider text-green-400 font-semibold mb-1">
            ⚡ PulseChain
          </p>
          <p className="text-lg font-bold text-foreground tabular-nums">
            {balances.loading ? "..." : balances.pls}
          </p>
          <p className="text-[10px] text-muted-foreground">PLS</p>
        </div>

        {/* BASE */}
        <div className="rounded-lg bg-background/60 p-3 border border-blue-500/20">
          <p className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold mb-1">
            🔵 BASE
          </p>
          <p className="text-lg font-bold text-foreground tabular-nums">
            {balances.loading ? "..." : balances.eth}
          </p>
          <p className="text-[10px] text-muted-foreground">ETH</p>
        </div>
      </div>

      {/* DAO Donation Note */}
      <div className="mt-3 flex items-start gap-2 p-2 rounded-md bg-[var(--hero-orange)]/5 border border-[var(--hero-orange)]/20">
        <Vote className="w-4 h-4 text-[var(--hero-orange)] shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          These funds will be donated to the winner of the <strong className="text-foreground">quarterly DAO vote</strong>. 
          Community members vote on which veteran-focused cause receives the treasury allocation.
        </p>
      </div>
    </div>
  );
}
