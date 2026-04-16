/*
 * HEROBASE.IO — Live Price Ticker
 * Fetches real-time prices from DEX Screener API
 * Supports PulseChain and BASE chain tokens
 * Auto-refreshes every 30 seconds
 */
import { useState, useEffect, useCallback } from 'react';

interface PairConfig {
  symbol: string;
  pairAddress?: string;
  tokenAddress?: string;
  chain: string;
}

interface PriceData {
  price: number;
  change24h: number;
  volume24h: number;
  fdv: number;
}

const PULSECHAIN_PAIRS: PairConfig[] = [
  { symbol: 'EMIT', pairAddress: '0x1d05cc449b643633b013cbfb939e70cc0d37f2a3', chain: 'pulsechain' },
  { symbol: 'RHINO', pairAddress: '0x8e030e42fb8d7e1f21e827cea2fb91325f3f6b00', chain: 'pulsechain' },
  { symbol: 'TruFarm', pairAddress: '0x086524a37deba61e08dc948ff677327de4a5150d', chain: 'pulsechain' },
];
const BASE_PAIRS: PairConfig[] = [
  { symbol: 'HERO', tokenAddress: '0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8', chain: 'base' },
  { symbol: 'BRETT', pairAddress: '0xba3f945812a83471d709bce9c3ca699a19fb46f7', chain: 'base' },
  { symbol: 'AERO', tokenAddress: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', chain: 'base' },
  { symbol: 'jesse', tokenAddress: '0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59', chain: 'base' },
];
const REFRESH_INTERVAL = 30000;

async function fetchPairPrice(chain: string, pairAddress: string): Promise<PriceData | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chain}/${pairAddress}`);
    const data = await res.json();
    if (data.pair) {
      return {
        price: parseFloat(data.pair.priceUsd) || 0,
        change24h: parseFloat(data.pair.priceChange?.h24) || 0,
        volume24h: parseFloat(data.pair.volume?.h24) || 0,
        fdv: parseFloat(data.pair.fdv) || 0,
      };
    }
  } catch (e) {
    console.warn("Failed to fetch " + chain + "/" + pairAddress + ":", e);
  }
  return null;
}

async function fetchTokenPrice(chain: string, tokenAddress: string): Promise<PriceData | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await res.json();
    if (data.pairs && data.pairs.length > 0) {
      const chainPairs = data.pairs.filter((p: any) => p.chainId === chain);
      const best = chainPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      if (best) {
        return {
          price: parseFloat(best.priceUsd) || 0,
          change24h: parseFloat(best.priceChange?.h24) || 0,
          volume24h: parseFloat(best.volume?.h24) || 0,
          fdv: parseFloat(best.fdv) || 0,
        };
      }
    }
  } catch (e) {
    console.warn("Failed to fetch token " + tokenAddress + ":", e);
  }
  return null;
}

function formatPrice(price: number): string {
  if (price === 0) return '$0.00';
  if (price < 0.001) return '$' + price.toFixed(8);
  if (price < 1) return '$' + price.toFixed(4);
  if (price < 1000) return '$' + price.toFixed(2);
  return '$' + price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatVolume(vol: number): string {
  if (vol >= 1e6) return '$' + (vol / 1e6).toFixed(1) + 'M';
  if (vol >= 1e3) return '$' + (vol / 1e3).toFixed(1) + 'K';
  return '$' + vol.toFixed(0);
}

interface LiveTickerProps {
  activeChain?: string;
}

export default function LiveTicker({ activeChain = 'pulsechain' }: LiveTickerProps) {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(true);
  const pairs = activeChain === 'pulsechain' ? PULSECHAIN_PAIRS : BASE_PAIRS;
  const fetchAll = useCallback(async () => {
    const results: Record<string, PriceData> = {};
    await Promise.all(
      pairs.map(async (p) => {
        let data: PriceData | null = null;
        if (p.pairAddress) {
          data = await fetchPairPrice(p.chain, p.pairAddress);
        } else if (p.tokenAddress) {
          data = await fetchTokenPrice(p.chain, p.tokenAddress);
        }
        if (data) results[p.symbol] = data;
      })
    );
    setPrices(results);
    setLoading(false);
  }, [activeChain]);
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll]);
  if (loading) {
    return (
      <div className="flex items-center gap-4 overflow-hidden py-2 px-4 bg-black/20">
        <span className="text-white/50 text-xs animate-pulse">Loading prices...</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-6 overflow-x-auto py-2 px-4 bg-black/20 scrollbar-hide">
      {pairs.map(({ symbol }) => {
        const data = prices[symbol];
        if (!data) return null;
        const isUp = data.change24h >= 0;
        return (
          <div key={symbol} className="flex items-center gap-2 shrink-0">
            <span className="text-white font-bold text-xs">{symbol}</span>
            <span className="text-white text-xs">{formatPrice(data.price)}</span>
            <span className={`text-xs font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}{data.change24h.toFixed(1)}%
            </span>
            <span className="text-white/40 text-xs">Vol: {formatVolume(data.volume24h)}</span>
          </div>
        );
      })}
    </div>
  );
}
