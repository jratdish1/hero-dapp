import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, RefreshCw } from "lucide-react";
import { TokenBalance, getRpcClient, retryWithBackoff, formatUnits, erc20Abi } from "./WalletUtils";
import { toast } from "sonner";

interface WalletTokenListProps {
  address: string | undefined;
  balances: TokenBalance[];
  setBalances: React.Dispatch<React.SetStateAction<TokenBalance[]>>;
}

const BALANCE_CHAINS = {
  pulsechain: {
    rpcs: ["https://rpc-pulsechain.g4mm4.io", "https://rpc.pulsechain.com", "https://pulsechain-rpc.publicnode.com"],
    nativeSymbol: "PLS",
    nativeName: "Pulse",
    tokens: [
      { address: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27", symbol: "HERO", name: "HERO Token", decimals: 18 },
      { address: "0x4013abBf94A745EfA7cc848989Ee83424A770060", symbol: "VETS", name: "VETERANS", decimals: 18 },
    ],
  },
  base: {
    rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://1rpc.io/base"],
    nativeSymbol: "ETH",
    nativeName: "Ether",
    tokens: [{ address: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8", symbol: "HERO", name: "HERO Token", decimals: 18 }],
  },
};

export function WalletTokenList({ address, balances, setBalances }: WalletTokenListProps) {
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    if (!navigator.onLine) {
      toast.error("Network error — check your connection");
      return;
    }
    setLoading(true);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const allBalances: TokenBalance[] = [];

    try {
      for (const [chainKey, chain] of Object.entries(BALANCE_CHAINS)) {
        if (abortController.signal.aborted) break;
        const client = getRpcClient(chainKey, (chain as any).rpcs);

        // Native balance
        try {
          const nativeBal = await retryWithBackoff(() => client.getBalance({ address: address as `0x${string}` }));
          if (nativeBal > 0n) {
            allBalances.push({
              symbol: chain.nativeSymbol,
              name: chain.nativeName,
              balance: formatUnits(nativeBal, 18),
              valueUsd: "0",
              address: "0x0000000000000000000000000000000000000000",
              decimals: 18,
              chain: chainKey,
            });
          }
        } catch (e) {
          console.warn(`Native balance error on ${chainKey}:`, e);
        }

        // ERC20 balances with multicall and error handling
        try {
          const calls = chain.tokens.map((t: any) => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [address as `0x${string}`],
          }));
          const results = await retryWithBackoff(() => client.multicall({ contracts: calls }));
          if (!Array.isArray(results)) {
            console.warn(`Multicall returned invalid results on ${chainKey}`);
            continue;
          }
          results.forEach((result: any, i: number) => {
            const token = chain.tokens[i];
            if (result && typeof result === "object" && "status" in result && "result" in result) {
              if (result.status === "success" && result.result > 0n) {
                allBalances.push({
                  symbol: token.symbol,
                  name: token.name,
                  balance: formatUnits(result.result as bigint, token.decimals),
                  valueUsd: "0",
                  address: token.address,
                  decimals: token.decimals,
                  chain: chainKey,
                });
              }
            } else if (typeof result === "bigint" && result > 0n) {
              allBalances.push({
                symbol: token.symbol,
                name: token.name,
                balance: formatUnits(result, token.decimals),
                valueUsd: "0",
                address: token.address,
                decimals: token.decimals,
                chain: chainKey,
              });
            }
          });
        } catch (e) {
          console.warn(`Token balance error on ${chainKey}:`, e);
        }
      }
      if (!abortController.signal.aborted) {
        setBalances(allBalances);
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        console.error("Failed to fetch balances:", e);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [address, setBalances]);

  useEffect(() => {
    fetchBalances();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchBalances]);

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-white">Token Balances</h3>
        <Button variant="ghost" size="sm" onClick={fetchBalances} disabled={loading} aria-label="Refresh balances">
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {balances.length === 0 ? (
        <Card className="bg-black/95 border-gray-700">
          <CardContent className="p-8 text-center text-gray-400">
            <Coins className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
            <p>No balances found. Connect wallet and refresh.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {balances.map((token, i) => (
            <Card key={i} className="bg-black/95 border-gray-700 hover:border-yellow-500/30 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Coins className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{token.symbol}</p>
                    <p className="text-xs text-gray-500">{token.chain}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-white">{parseFloat(token.balance).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">${parseFloat(token.valueUsd).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
