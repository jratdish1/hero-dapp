/**
 * usePrices — React hook for consuming live price data from DexScreener via tRPC.
 * Auto-refreshes every 30 seconds. Used across Dashboard, Swap, Portfolio, Farm, Tokenomics.
 */
import { trpc } from "@/lib/trpc";

export function useMarketOverview(chain?: "pulsechain" | "base") {
  return trpc.prices.overview.useQuery(
    chain ? { chain } : undefined,
    {
      refetchInterval: 30_000,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    }
  );
}

export function usePriceTicker(chain?: "pulsechain" | "base") {
  return trpc.prices.ticker.useQuery(
    chain ? { chain } : undefined,
    {
      refetchInterval: 30_000,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    }
  );
}

export function useBasePairs() {
  return trpc.prices.basePairs.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useFarmPools(chain?: "pulsechain" | "base") {
  return trpc.prices.farmPools.useQuery(
    chain ? { chain } : undefined,
    {
      refetchInterval: 30_000,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    }
  );
}

export function useBuyAndBurn() {
  return trpc.prices.buyAndBurn.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function usePairSearch(query: string) {
  return trpc.prices.search.useQuery(
    { query },
    {
      enabled: query.length > 0,
      staleTime: 30_000,
    }
  );
}

/**
 * Helper to format price with appropriate decimal places.
 */
export function formatPrice(price: string | number | undefined | null): string {
  if (!price) return "$0.00";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "$0.00";
  if (num >= 1000) return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(8)}`;
}

/**
 * Format large numbers with K/M/B suffixes.
 */
export function formatCompact(value: number | undefined | null): string {
  if (!value) return "$0";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage change with + or - prefix and color hint.
 */
export function formatChange(change: number | undefined | null): { text: string; positive: boolean } {
  if (change === null || change === undefined) return { text: "0.00%", positive: true };
  const positive = change >= 0;
  return {
    text: `${positive ? "+" : ""}${change.toFixed(2)}%`,
    positive,
  };
}
