/**
 * PriceTicker — Scrolling real-time price bar for HERO, VETS, PLS, ETH.
 * Sits at the top of the AppLayout header. Auto-refreshes every 30s.
 */
import { usePriceTicker, formatPrice, formatChange } from "@/hooks/usePrices";

function TickerItem({ symbol, price, change24h, icon }: {
  symbol: string;
  price: string | undefined | null;
  change24h: number | undefined | null;
  icon: string;
}) {
  const { text, positive } = formatChange(change24h);
  return (
    <span className="inline-flex items-center gap-1.5 px-3 whitespace-nowrap">
      <span className="text-xs opacity-60">{icon}</span>
      <span className="font-semibold text-xs">{symbol}</span>
      <span className="text-xs font-mono">{formatPrice(price)}</span>
      <span className={`text-xs font-mono ${positive ? "text-green-400" : "text-red-400"}`}>
        {text}
      </span>
    </span>
  );
}

export default function PriceTicker() {
  const { data, isLoading } = usePriceTicker();

  if (isLoading || !data) {
    return (
      <div className="w-full bg-card/50 border-b border-border/30 py-1 overflow-hidden">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground animate-pulse">
          Loading live prices...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-card/50 border-b border-border/30 py-1 overflow-hidden">
      <div className="flex animate-scroll-x">
        <div className="flex items-center shrink-0">
          <TickerItem symbol="HERO" price={data.hero?.price} change24h={data.hero?.change24h} icon="🦸" />
          <span className="text-border/50">|</span>
          <TickerItem symbol="VETS" price={data.vets?.price} change24h={data.vets?.change24h} icon="🎖️" />
          <span className="text-border/50">|</span>
          <TickerItem symbol="PLS" price={data.pls?.price} change24h={data.pls?.change24h} icon="⚡" />
          <span className="text-border/50">|</span>
          <TickerItem symbol="ETH" price={data.eth?.price} change24h={data.eth?.change24h} icon="💎" />
        </div>
        {/* Duplicate for seamless scroll loop */}
        <div className="flex items-center shrink-0" aria-hidden>
          <TickerItem symbol="HERO" price={data.hero?.price} change24h={data.hero?.change24h} icon="🦸" />
          <span className="text-border/50">|</span>
          <TickerItem symbol="VETS" price={data.vets?.price} change24h={data.vets?.change24h} icon="🎖️" />
          <span className="text-border/50">|</span>
          <TickerItem symbol="PLS" price={data.pls?.price} change24h={data.pls?.change24h} icon="⚡" />
          <span className="text-border/50">|</span>
          <TickerItem symbol="ETH" price={data.eth?.price} change24h={data.eth?.change24h} icon="💎" />
        </div>
      </div>
    </div>
  );
}
