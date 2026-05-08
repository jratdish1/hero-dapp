import { useState, useMemo } from "react";
import { AlertTriangle, TrendingDown, BarChart3, Info, X } from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";
import { useMarketOverview, formatCompact } from "../hooks/usePrices";

// ─── Constants ────────────────────────────────────────────────────────────────
const PLS_PRICE_FALLBACK = 0.00000749;

// ─── Helpers (outside component) ──────────────────────────────────────────────
const getImpactLevel = (pct: number) => {
  if (pct < 1) return { level: "low", color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/30", label: "Low Impact" };
  if (pct < 3) return { level: "moderate", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30", label: "Moderate Impact" };
  if (pct < 5) return { level: "high", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30", label: "High Impact" };
  return { level: "severe", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/30", label: "Severe Impact" };
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface PriceImpactWarningProps {
  fromToken?: string;
  toToken?: string;
  amount?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PriceImpactWarning({ fromToken = "PLS", toToken = "HERO", amount = "1000000" }: PriceImpactWarningProps) {
  const { isPulseChain } = useNetwork();
  const { data: market } = useMarketOverview();
  const [showModal, setShowModal] = useState(false);

  // Calculate estimated price impact with division-by-zero guards
  const impactData = useMemo(() => {
    if (!market?.heroPrice) return null;

    const heroLiquidity = market.heroPrice.liquidity?.usd || 150000;
    if (heroLiquidity <= 0) return null; // Guard

    const parsedAmount = parseFloat(amount ?? "0");
    if (isNaN(parsedAmount) || parsedAmount <= 0) return null; // Guard

    const plsPrice = market.plsPrice?.priceUsd ? parseFloat(market.plsPrice.priceUsd) : PLS_PRICE_FALLBACK;
    const inputUsd = parsedAmount * plsPrice;

    // Price impact formula: impact = tradeSize / (2 * liquidity) * 100
    const impact = (inputUsd / (2 * heroLiquidity)) * 100;
    const clampedImpact = Math.min(impact, 99);

    return {
      impact: clampedImpact,
      inputUsd,
      liquidity: heroLiquidity,
      volume24h: market.heroPrice.volume24h || 25000,
      tradeToLiquidityRatio: heroLiquidity > 0 ? (inputUsd / heroLiquidity) * 100 : 0,
    };
  }, [market?.heroPrice, market?.plsPrice, amount]);

  if (!impactData) return null;

  const { impact, liquidity, volume24h, tradeToLiquidityRatio } = impactData;
  const impactInfo = getImpactLevel(impact);

  return (
    <>
      <div className={`rounded-xl border ${impactInfo.border} ${impactInfo.bg} p-4 space-y-3`}>
        {/* Impact header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {impact >= 5 ? (
              <AlertTriangle className={`w-4 h-4 ${impactInfo.color}`} />
            ) : (
              <TrendingDown className={`w-4 h-4 ${impactInfo.color}`} />
            )}
            <span className={`text-sm font-bold ${impactInfo.color}`}>
              Price Impact: {impact.toFixed(2)}%
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${impactInfo.bg} ${impactInfo.color} font-medium border ${impactInfo.border}`}>
              {impactInfo.label}
            </span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            aria-label="View price impact details"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Info className="w-3 h-3" /> Details
          </button>
        </div>

        {/* Impact bar visualization */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0%</span>
            <span>1%</span>
            <span>3%</span>
            <span>5%</span>
            <span>10%+</span>
          </div>
          <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
            <div className="absolute inset-0 flex">
              <div className="flex-1 bg-green-500/30" />
              <div className="flex-1 bg-yellow-500/30" />
              <div className="flex-1 bg-orange-500/30" />
              <div className="flex-1 bg-red-500/30" />
            </div>
            <div
              className={`absolute top-0 h-full w-1 rounded-full ${impactInfo.color.replace("text-", "bg-")}`}
              style={{ left: `${Math.min(impact * 10, 100)}%` }}
            />
          </div>
        </div>

        {/* Liquidity depth info */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-xs font-mono text-foreground">{formatCompact(liquidity)}</div>
            <div className="text-[10px] text-muted-foreground">Liquidity</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-mono text-foreground">{formatCompact(volume24h)}</div>
            <div className="text-[10px] text-muted-foreground">24h Volume</div>
          </div>
          <div className="text-center">
            <div className={`text-xs font-mono ${impactInfo.color}`}>{tradeToLiquidityRatio.toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">Trade/Liq Ratio</div>
          </div>
        </div>

        {/* Warning for high impact */}
        {impact >= 5 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-red-400 font-medium">High price impact detected</p>
              <p className="text-[10px] text-red-400/80 mt-0.5">
                Consider splitting this trade into smaller amounts or using a limit order to get a better rate.
              </p>
            </div>
          </div>
        )}

        {/* Recommendation */}
        {impact >= 3 && impact < 5 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <BarChart3 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-orange-400">
              Tip: Try splitting into 2-3 smaller swaps or use SquirrelSwap&apos;s DCA feature for better average price.
            </p>
          </div>
        )}
      </div>

      {/* Detail modal with ARIA */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-impact-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 id="price-impact-title" className="text-lg font-bold text-foreground">Price Impact Explained</h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close price impact details"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Price impact</strong> is the difference between the current market price and the price you&apos;ll actually receive due to your trade size relative to available liquidity.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span><strong className="text-green-400">&lt;1%</strong> — Excellent. Normal for most trades.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span><strong className="text-yellow-400">1-3%</strong> — Moderate. Acceptable for larger trades.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-400" />
                  <span><strong className="text-orange-400">3-5%</strong> — High. Consider splitting your trade.</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span><strong className="text-red-400">&gt;5%</strong> — Severe. Strongly recommend smaller amounts.</span>
                </div>
              </div>
              <p className="text-xs border-t border-border pt-3">
                Your trade of <strong className="text-foreground">{formatCompact(impactData.inputUsd)}</strong> represents{" "}
                <strong className={impactInfo.color}>{tradeToLiquidityRatio.toFixed(1)}%</strong> of the pool&apos;s total liquidity ({formatCompact(liquidity)}).
              </p>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 rounded-lg bg-[var(--hero-green)]/20 text-[var(--hero-green)] text-sm font-medium hover:bg-[var(--hero-green)]/30 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
