/**
 * PriceTicker — Scrolling real-time price bar for HERO, VETS, PLS/ETH.
 * Chain-aware: PulseChain shows HERO/VETS/PLS; BASE shows HERO/ETH/USDC.
 * Auto-refreshes every 30s. Fixed: no overlap, high contrast, tabular-nums.
 */
import { usePriceTicker, formatPrice, formatChange } from "@/hooks/usePrices";
import { useNetwork } from "../contexts/NetworkContext";

function TickerItem({
  symbol,
  price,
  change24h,
  icon,
}: {
  symbol: string;
  price: string | undefined | null;
  change24h: number | undefined | null;
  icon: string;
}) {
  const { text, positive } = formatChange(change24h);
  return (
    <span className="inline-flex items-center gap-2 px-4 whitespace-nowrap h-8">
      <span className="text-sm leading-none">{icon}</span>
      <span className="font-bold text-xs tracking-wide text-white">{symbol}</span>
      <span className="text-xs font-mono text-white/90 tabular-nums">{formatPrice(price)}</span>
      <span
        className={`text-xs font-mono font-semibold tabular-nums ${
          positive ? "text-emerald-400" : "text-amber-400"
        }`}
      >
        {text}
      </span>
    </span>
  );
}

function Divider() {
  return (
    <span className="text-white/20 select-none text-base leading-none" aria-hidden>
      │
    </span>
  );
}

export default function PriceTicker() {
  const { isPulseChain, isBase } = useNetwork();
  const chain = isBase ? "base" : "pulsechain";
  const { data, isLoading } = usePriceTicker(chain);

  if (isLoading || !data) {
    return (
      <div
        className="w-full border-b border-[var(--hero-orange)]/20 overflow-hidden"
        style={{ background: "rgba(0,0,0,0.80)", height: "32px" }}
      >
        <div className="flex items-center justify-center h-full gap-3 text-xs text-white/50 animate-pulse">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--hero-orange)] inline-block"
            style={{ animation: "orangePulse 1.5s ease-in-out infinite" }}
          />
          Loading live prices...
        </div>
      </div>
    );
  }

  // Chain-specific token display
  const chainLabel = isBase ? "🔵 BASE" : "⚡ PulseChain";
  const nativeToken = isBase
    ? { symbol: "ETH", price: data.eth?.price, change24h: data.eth?.change24h, icon: "💎" }
    : { symbol: "PLS", price: data.pls?.price, change24h: data.pls?.change24h, icon: "⚡" };

  const makeItems = () => (
    <div className="flex items-center shrink-0">
      {/* Chain label badge */}
      <span className="inline-flex items-center gap-1 px-3 whitespace-nowrap h-8">
        <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--hero-orange)]/80">{chainLabel}</span>
      </span>
      <Divider />
      <TickerItem symbol="HERO" price={data.hero?.price} change24h={data.hero?.change24h} icon="🦸" />
      <Divider />
      {!isBase && (
        <>
          <TickerItem symbol="VETS" price={data.vets?.price} change24h={data.vets?.change24h} icon="🎖️" />
          <Divider />
        </>
      )}
      <TickerItem symbol={nativeToken.symbol} price={nativeToken.price} change24h={nativeToken.change24h} icon={nativeToken.icon} />
      <span className="w-12 shrink-0" />
    </div>
  );

  return (
    <div
      className="w-full border-b border-[var(--hero-orange)]/20 overflow-hidden"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(4px)", height: "32px" }}
    >
      <div className="flex items-center h-full animate-scroll-x">
        {/* First copy */}
        {makeItems()}
        {/* Duplicate for seamless loop */}
        <div aria-hidden>{makeItems()}</div>
      </div>
    </div>
  );
}
