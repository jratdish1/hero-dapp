/**
 * useWalletBalances — Shared multi-chain wallet balance hook
 *
 * Reads native + ERC-20 balances from Base (8453) and PulseChain (369)
 * using centralized config.ts for all token/chain data.
 *
 * State machine:
 *   "unsupported" | "loading" | "error" | "zero" | "success"
 *
 * Usage:
 *   const { chains, isLoading, error } = useWalletBalances();
 *   // or for a specific chain
 *   const baseBalances = chains[8453];
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { erc20Abi, createPublicClient, http, fallback, formatUnits } from "viem";
import { useAccount, useChainId } from "wagmi";
import {
  CHAINS,
  getRPCs,
  getTokens,
  isSupportedChainId,
} from "@/lib/config";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BalanceStatus = "unsupported" | "loading" | "error" | "zero" | "success";

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  rawBalance: bigint;
  decimals: number;
  address: `0x${string}`;
  isNative: boolean;
}

export interface ChainBalances {
  chainId: number;
  status: BalanceStatus;
  error?: string;
  tokens: TokenBalance[];
  nativeBalance?: TokenBalance;
}

export interface WalletBalances {
  /** ChainId → per-chain balance data */
  chains: Partial<Record<8453 | 369, ChainBalances>>;
  /** true while any chain is loading */
  isLoading: boolean;
  /** true when any chain has an error (network issues, RPC failures) */
  isError: boolean;
  /** true when no chains are supported for the current connection */
  isUnsupported: boolean;
  /** Aggregate error message if any */
  error?: string;
  /** Manual refetch */
  refetch: () => void;
}

// ─── RPC Client Cache ─────────────────────────────────────────────────────────

const rpcClientCache: Record<number, ReturnType<typeof createPublicClient>> = {};

function getChainClient(chainId: number): ReturnType<typeof createPublicClient> | null {
  if (!isSupportedChainId(chainId)) return null;
  if (rpcClientCache[chainId]) return rpcClientCache[chainId];

  const rpcs = getRPCs(chainId);
  if (!rpcs.length) return null;

  const client = createPublicClient({
    transport: fallback(rpcs.map((r) => http(r, { timeout: 10000, retryCount: 1 }))),
  });
  rpcClientCache[chainId] = client;
  return client;
}

// ─── Core balance reader (non-hook) ─────────────────────────────────────────

export interface BalanceResult {
  status: BalanceStatus;
  error?: string;
  native?: TokenBalance;
  tokens: TokenBalance[];
}

async function fetchChainBalances(
  chainId: 8453 | 369,
  address: `0x${string}`,
  signal?: AbortSignal
): Promise<BalanceResult> {
  const client = getChainClient(chainId);
  if (!client) return { status: "unsupported", tokens: [] };

  const chainConfig = CHAINS[chainId];
  if (!chainConfig) return { status: "unsupported", tokens: [] };

  const tokens = getTokens(chainId);
  const allBalances: TokenBalance[] = [];

  try {
    // Native balance
    if (signal?.aborted) return { status: "error", tokens: [] };
    try {
      const nativeBal = await client.getBalance({ address });
      if (nativeBal > 0n) {
        const nativeToken = tokens.find((t) => t.isNative);
        allBalances.push({
          symbol: chainConfig.nativeSymbol,
          name: chainConfig.nativeName,
          balance: formatUnits(nativeBal, nativeToken?.decimals ?? 18),
          rawBalance: nativeBal,
          decimals: nativeToken?.decimals ?? 18,
          address: "0x0000000000000000000000000000000000000000",
          isNative: true,
        });
      }
    } catch (e) {
      console.warn(`[useWalletBalances] Native balance error on chain ${chainId}:`, e);
    }

    // ERC-20 balances via multicall
    if (signal?.aborted) return { status: "error", tokens: [] };
    const erc20Tokens = tokens.filter((t) => !t.isNative);
    if (erc20Tokens.length > 0) {
      const calls = erc20Tokens.map((t) => ({
        address: t.ca as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [address] as const,
      }));

      const results = await client.multicall({ contracts: calls });
      if (Array.isArray(results)) {
        results.forEach((result, i) => {
          if (result && typeof result === "object" && "status" in result && "result" in result) {
            if (result.status === "success" && result.result > 0n) {
              const token = erc20Tokens[i];
              allBalances.push({
                symbol: token.symbol,
                name: token.name ?? token.symbol,
                balance: formatUnits(result.result as bigint, token.decimals),
                rawBalance: result.result as bigint,
                decimals: token.decimals,
                address: token.ca,
                isNative: false,
              });
            }
          }
        });
      }
    }

    return {
      status: allBalances.length === 0 ? "zero" : "success",
      tokens: allBalances.filter((b) => !b.isNative),
      native: allBalances.find((b) => b.isNative),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch balances";
    return { status: "error", error: msg, tokens: [] };
  }
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

interface UseWalletBalancesOptions {
  /** If true, reads balances from both chains even if disconnected */
  readUnconnected?: boolean;
}

/**
 * Multi-chain wallet balance hook.
 * Fetches native + ERC-20 balances from Base (8453) and PulseChain (369)
 * using centralized config.ts. Supports abort for re-fetch cancellation.
 */
export function useWalletBalances(options: UseWalletBalancesOptions = {}): WalletBalances {
  const { readUnconnected = false } = options;
  const { address, isConnected } = useAccount();
  const wagmiChainId = useChainId();

  const [chainStates, setChainStates] = useState<Partial<Record<8453 | 369, ChainBalances>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [globalError, setGlobalError] = useState<string | undefined>();

  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchCountRef = useRef(0);

  const isUnsupported = useMemo(() => {
    return !isSupportedChainId(wagmiChainId) && !readUnconnected;
  }, [wagmiChainId, readUnconnected]);

  const fetchBalances = useCallback(async () => {
    const effectiveAddress = address as `0x${string}` | undefined;
    if (!effectiveAddress && !readUnconnected) {
      setChainStates({});
      setIsLoading(false);
      setIsError(false);
      return;
    }

    if (!effectiveAddress) {
      setChainStates({});
      setIsLoading(false);
      setIsError(false);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const fetchId = ++fetchCountRef.current;

    // Initialize loading state for both chains
    const initialStates: Partial<Record<8453 | 369, ChainBalances>> = {};
    const chainIds: (8453 | 369)[] = [8453, 369];
    for (const cid of chainIds) {
      initialStates[cid] = { chainId: cid, status: "loading", tokens: [] };
    }
    setChainStates(initialStates);
    setIsLoading(true);
    setIsError(false);
    setGlobalError(undefined);

    // Fetch both chains in parallel
    const results = await Promise.allSettled(
      chainIds.map((chainId) => fetchChainBalances(chainId, effectiveAddress, abortController.signal))
    );

    // Only apply if this fetch is still the current one
    if (fetchId !== fetchCountRef.current || abortController.signal.aborted) return;

    const newStates: Partial<Record<8453 | 369, ChainBalances>> = {};
    let hasError = false;

    results.forEach((result, i) => {
      const chainId = chainIds[i];
      if (result.status === "fulfilled") {
        const r = result.value;
        newStates[chainId] = {
          chainId,
          status: r.status,
          error: r.error,
          tokens: r.tokens,
          nativeBalance: r.native,
        };
        if (r.status === "error") hasError = true;
      } else {
        newStates[chainId] = {
          chainId,
          status: "error",
          error: result.reason instanceof Error ? result.reason.message : "Unknown error",
          tokens: [],
        };
        hasError = true;
      }
    });

    setChainStates(newStates);
    setIsLoading(false);
    setIsError(hasError);
    if (hasError) {
      const errors = Object.values(newStates)
        .filter((s) => s?.status === "error")
        .map((s) => s!.error)
        .filter(Boolean);
      setGlobalError(errors.length > 0 ? errors.join("; ") : "Balance fetch failed");
    } else {
      setGlobalError(undefined);
    }
  }, [address, readUnconnected]);

  // Refetch on address/chain changes
  useEffect(() => {
    if (isConnected && address) {
      fetchBalances();
    } else if (readUnconnected && address) {
      fetchBalances();
    } else {
      fetchCountRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setChainStates({});
      setIsLoading(false);
      setIsError(false);
      setGlobalError(undefined);
    }
  }, [address, wagmiChainId, isConnected, readUnconnected, fetchBalances]);

  useEffect(() => {
    return () => {
      fetchCountRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    chains: chainStates,
    isLoading,
    isError,
    isUnsupported,
    error: globalError,
    refetch: () => {
      void fetchBalances();
    },
  };
}

/**
 * Get total balance of a specific token symbol across all chains.
 */
export function useTotalTokenBalance(symbol: string): {
  total: bigint;
  formatted: string;
  decimals: number;
  chains: Array<{ chainId: number; balance: bigint; formatted: string }>;
} {
  const { chains } = useWalletBalances();

  return useMemo(() => {
    let total = BigInt(0);
    let decimals = 18;
    const chainBalances: Array<{ chainId: number; balance: bigint; formatted: string }> = [];

    for (const [chainId, state] of Object.entries(chains)) {
      if (!state || state.status !== "success") continue;
      const entry = [...(state.tokens ?? []), state.nativeBalance].find(
        (t) => t?.symbol.toUpperCase() === symbol.toUpperCase()
      );
      if (entry) {
        decimals = entry.decimals;
        total += entry.rawBalance;
        chainBalances.push({
          chainId: parseInt(chainId),
          balance: entry.rawBalance,
          formatted: entry.balance,
        });
      }
    }

    return {
      total,
      formatted: Number(formatUnits(total, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 }),
      decimals,
      chains: chainBalances,
    };
  }, [chains, symbol]);
}
