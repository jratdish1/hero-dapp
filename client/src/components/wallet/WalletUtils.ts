import { createPublicClient, http, fallback, erc20Abi, formatUnits, isAddress } from "viem";
import { toast } from "sonner";

// Re-export viem utilities for subcomponents
export { erc20Abi, formatUnits, isAddress };

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string;
  address: string;
  decimals: number;
  chain: string;
}

export interface GasPrice {
  chain: string;
  fast: string;
  standard: string;
  slow: string;
  nativePrice: string;
}

export interface Approval {
  token: string;
  spender: string;
  spenderName: string;
  allowance: string;
  risk: 'low' | 'medium' | 'high';
}

export interface PrivacyBalance {
  symbol: string;
  shieldedAmount: string;
  chain: string;
}

// Wallet API base URL (not yet deployed - balance reads use on-chain)
export const WALLET_API = "";

// Cache for RPC clients by chain key
const rpcClientCache: Record<string, ReturnType<typeof createPublicClient>> = {};

// Helper to create or get cached RPC client with fallback transport
export function getRpcClient(chainKey: string, rpcs: string[]) {
  if (rpcClientCache[chainKey]) return rpcClientCache[chainKey];
  const client = createPublicClient({
    transport: fallback(rpcs.map((r) => http(r, { timeout: 10000, retryCount: 1 }))),
  });
  rpcClientCache[chainKey] = client;
  return client;
}

// ─── Retry with exponential backoff ─────────────────────────────────────────
export async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delays = [1000, 2000, 4000]): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < retries - 1) {
        await new Promise((res) => setTimeout(res, delays[i]));
      }
    }
  }
  throw lastError;
}

// ─── Error differentiation helper ───────────────────────────────────────────
export function handleRpcError(error: unknown) {
  const err = error as any;
  if (err?.name === "AbortError") return; // Silently ignore aborts
  if (!navigator.onLine) {
    toast.error("Network error — check your connection");
  } else if (err?.code === 4001 || err?.message?.toLowerCase().includes("user rejected")) {
    toast.error("Transaction cancelled by user");
  } else if (err?.message?.toLowerCase().includes("rpc") || err?.message?.toLowerCase().includes("unavailable")) {
    toast.error("RPC unavailable — trying fallback");
  } else {
    toast.error("An unexpected error occurred");
    console.error("[HeroWallet] Unknown error:", error);
  }
}

// Sanitize token symbol input (allow only alphanumeric uppercase, max length 10)
export function sanitizeTokenSymbol(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

// Validate token symbol against known tokens in balances or allowlist (simple allowlist here)
export function isValidTokenSymbol(symbol: string, balances: TokenBalance[]): boolean {
  if (!symbol) return false;
  const allowlist = balances.map((b) => b.symbol.toUpperCase());
  return allowlist.includes(symbol.toUpperCase());
}

// Validate Ethereum address
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}
