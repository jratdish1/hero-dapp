/**
 * HeroBase.io - Shared Wallet Balances Hook
 * Fetches all token balances across all supported chains for a given address.
 * Replaces duplicate balance-fetching logic scattered across components.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { createPublicClient, http, fallback, erc20Abi, formatUnits, httpBatchLink } from "viem";
import { base, mainnet } from "viem/chains";
import { getChainConfig, SUPPORTED_CHAIN_IDS, type SupportedChainId } from "@/lib/config";

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string;
  address: string;
  decimals: number;
  chain: string;
  chainId: SupportedChainId;
}

export interface UseWalletBalancesResult {
  balances: TokenBalance[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Chain name to viem chain mapping
const CHAIN_MAP: Record<string, typeof base> = {
  base: base,
  pulsechain: mainnet, // PulseChain uses Ethereum-compatible RPC
};

// Create RPC client for a chain
function getRpcClient(chainName: string, rpcs: string[]) {
  const viemChain = CHAIN_MAP[chainName] || mainnet;
  const transports = rpcs.map(rpc => http(rpc));
  const transport = transports.length > 1 ? fallback(transports) : transports[0];
  return createPublicClient({
    chain: viemChain,
    transport,
  });
}

/**
 * Hook to fetch all wallet balances across all supported chains.
 * Uses centralized config from lib/config.ts.
 */
export function useWalletBalances(address: string | undefined) {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Track mounted state to avoid state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!address) {
      setBalances([]);
      return;
    }

    if (!navigator.onLine) {
      setError(new Error("Network error — check your connection"));
      return;
    }

    setLoading(true);
    setError(null);

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const allBalances: TokenBalance[] = [];

    try {
      // Iterate over all supported chains from centralized config
      for (const chainId of SUPPORTED_CHAIN_IDS) {
        if (abortController.signal.aborted) break;
        if (!isMountedRef.current) break;

        const config = getChainConfig(chainId);
        if (!config) continue;

        const client = getRpcClient(config.name, config.rpcs);

        // Native token balance
        try {
          const nativeBal = await client.getBalance({ 
            address: address as `0x${string}`,
            blockTag: "latest" 
          });
          
          if (nativeBal > 0n && !abortController.signal.aborted) {
            allBalances.push({
              symbol: config.nativeSymbol,
              name: config.nativeName,
              balance: formatUnits(nativeBal, config.decimals ?? 18),
              valueUsd: "0",
              address: "0x0000000000000000000000000000000000000000",
              decimals: config.decimals ?? 18,
              chain: config.name,
              chainId,
            });
          }
        } catch (e) {
          console.warn(`[useWalletBalances] Native balance error on ${config.name}:`, e);
        }

        // ERC-20 token balances (skip native token)
        try {
          const erc20Tokens = config.tokens.filter(t => 
            t.ca !== "0x0000000000000000000000000000000000000000" &&
            t.ca.toLowerCase() !== config.heroCA.toLowerCase() // Skip HERO for now (can add back)
          );

          if (erc20Tokens.length > 0 && !abortController.signal.aborted) {
            const calls = erc20Tokens.map((t) => ({
              address: t.ca as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf" as const,
              args: [address as `0x${string}`],
            }));

            const results = await client.multicall({ contracts: calls });

            if (Array.isArray(results)) {
              results.forEach((result, i) => {
                if (abortController.signal.aborted) return;
                
                const token = erc20Tokens[i];
                if (!token) return;

                // Handle both success objects and direct bigint returns
                const balance = "result" in (result as any) 
                  ? (result as any).status === "success" ? (result as any).result : 0n
                  : typeof result === "bigint" ? result : 0n;

                if (balance > 0n) {
                  allBalances.push({
                    symbol: token.symbol,
                    name: token.symbol,
                    balance: formatUnits(balance, token.decimals),
                    valueUsd: "0",
                    address: token.ca,
                    decimals: token.decimals,
                    chain: config.name,
                    chainId,
                  });
                }
              });
            }
          }
        } catch (e) {
          console.warn(`[useWalletBalances] Token balance error on ${config.name}:`, e);
        }
      }

      if (!abortController.signal.aborted && isMountedRef.current) {
        setBalances(allBalances);
      }
    } catch (e) {
      if (!abortController.signal.aborted && isMountedRef.current) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [address]);

  // Auto-fetch when address changes
  useEffect(() => {
    fetchBalances();
    
    // Cleanup on unmount or address change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchBalances]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    balances,
    loading,
    error,
    refetch: fetchBalances,
  };
}

/**
 * Get total balance across all chains for a specific token symbol.
 */
export function getTotalBalanceBySymbol(balances: TokenBalance[], symbol: string): string {
  const matchingBalances = balances.filter(b => b.symbol.toUpperCase() === symbol.toUpperCase());
  
  if (matchingBalances.length === 0) return "0";
  
  const total = matchingBalances.reduce((acc, b) => {
    const num = parseFloat(b.balance) || 0;
    return acc + num;
  }, 0);
  
  return total.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/**
 * Group balances by chain.
 */
export function getBalancesByChain(balances: TokenBalance[]): Record<string, TokenBalance[]> {
  return balances.reduce((acc, balance) => {
    if (!acc[balance.chain]) {
      acc[balance.chain] = [];
    }
    acc[balance.chain].push(balance);
    return acc;
  }, {} as Record<string, TokenBalance[]>);
}