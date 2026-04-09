import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  Fuel,
  TrendingUp,
  Activity,
  DollarSign,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Droplets,
  Flame,
} from "lucide-react";
import { useMarketOverview, formatPrice, formatCompact, formatChange } from "@/hooks/usePrices";
import { HERO_TOKEN, VETS_TOKEN, FEATURED_TOKENS } from "../../../shared/tokens";

export default function Dashboard() {
  const { data: market, isLoading, refetch, isRefetching } = useMarketOverview();

  const heroPrice = market?.heroPrice;
  const vetsPrice = market?.vetsPrice;
  const plsPrice = market?.plsPrice;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live market data{" "}
            {market?.lastUpdated && (
              <span className="text-xs opacity-60">
                · Updated {new Date(market.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border hover:hero-glow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-secondary">
                <DollarSign className="w-5 h-5 text-[var(--hero-orange)]" />
              </div>
              {heroPrice && (
                <span className={`text-xs font-medium flex items-center gap-0.5 ${heroPrice.priceChange24h >= 0 ? "text-[var(--hero-green)]" : "text-destructive"}`}>
                  {heroPrice.priceChange24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {formatChange(heroPrice.priceChange24h).text}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">HERO Price</p>
            <p className="text-xl font-bold text-foreground">
              {isLoading ? "..." : formatPrice(heroPrice?.priceUsd)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:hero-glow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-secondary">
                <BarChart3 className="w-5 h-5 text-[var(--hero-green)]" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">HERO Market Cap</p>
            <p className="text-xl font-bold text-foreground">
              {isLoading ? "..." : formatCompact(market?.heroMarketCap)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:hero-glow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Droplets className="w-5 h-5 text-[var(--hero-green)]" />
              </div>
              {vetsPrice && (
                <span className={`text-xs font-medium flex items-center gap-0.5 ${vetsPrice.priceChange24h >= 0 ? "text-[var(--hero-green)]" : "text-destructive"}`}>
                  {vetsPrice.priceChange24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {formatChange(vetsPrice.priceChange24h).text}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">VETS Price</p>
            <p className="text-xl font-bold text-foreground">
              {isLoading ? "..." : formatPrice(vetsPrice?.priceUsd)}
            </p>
            {vetsPrice && <p className="text-xs text-muted-foreground mt-0.5">Liq: {formatCompact(market?.totalVetsLiquidity)}</p>}
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:hero-glow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Activity className="w-5 h-5 text-[var(--hero-green)]" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">HERO 24h Volume</p>
            <p className="text-xl font-bold text-foreground">
              {isLoading ? "..." : formatCompact(heroPrice?.volume24h)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Token Prices — Live from DexScreener */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--hero-orange)]" />
            Live Token Prices
            <span className="ml-auto text-xs text-muted-foreground font-normal flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--hero-green)] animate-pulse" />
              DexScreener
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground animate-pulse">Loading live prices...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground font-medium py-3 px-2">Token</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-2">Price</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-2">24h Change</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-2">24h Volume</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-2">Liquidity</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-3 px-2">Market Cap</th>
                  </tr>
                </thead>
                <tbody>
                  {/* HERO */}
                  {heroPrice && (
                    <tr className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <img src={HERO_TOKEN.logoURI} alt="HERO" className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=HERO&background=random&size=32`; }} />
                          <div>
                            <p className="font-semibold text-foreground">HERO</p>
                            <p className="text-xs text-muted-foreground">HERO Token for Veterans</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 font-mono font-medium text-foreground">{formatPrice(heroPrice.priceUsd)}</td>
                      <td className="text-right py-3 px-2">
                        <PriceChangeCell change={heroPrice.priceChange24h} />
                      </td>
                      <td className="text-right py-3 px-2 text-sm text-muted-foreground">{formatCompact(heroPrice.volume24h)}</td>
                      <td className="text-right py-3 px-2 text-sm text-muted-foreground">{formatCompact(heroPrice.liquidity)}</td>
                      <td className="text-right py-3 px-2 text-sm text-muted-foreground">{formatCompact(heroPrice.marketCap)}</td>
                    </tr>
                  )}
                  {/* VETS */}
                  {vetsPrice && (
                    <tr className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <img src={VETS_TOKEN.logoURI} alt="VETS" className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=VETS&background=random&size=32`; }} />
                          <div>
                            <p className="font-semibold text-foreground">VETS</p>
                            <p className="text-xs text-muted-foreground">VETERANS</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 font-mono font-medium text-foreground">{formatPrice(vetsPrice.priceUsd)}</td>
                      <td className="text-right py-3 px-2">
                        <PriceChangeCell change={vetsPrice.priceChange24h} />
                      </td>
                      <td className="text-right py-3 px-2 text-sm text-muted-foreground">{formatCompact(vetsPrice.volume24h)}</td>
                      <td className="text-right py-3 px-2 text-sm text-muted-foreground">{formatCompact(vetsPrice.liquidity)}</td>
                      <td className="text-right py-3 px-2 text-sm text-muted-foreground">{formatCompact(vetsPrice.marketCap)}</td>
                    </tr>
                  )}
                  {/* PLS */}
                  {plsPrice && (
                    <tr className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <img src={FEATURED_TOKENS[0].logoURI} alt="PLS" className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=PLS&background=random&size=32`; }} />
                          <div>
                            <p className="font-semibold text-foreground">PLS</p>
                            <p className="text-xs text-muted-foreground">Pulse</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 font-mono font-medium text-foreground">{formatPrice(plsPrice.priceUsd)}</td>
                      <td className="text-right py-3 px-2">
                        <PriceChangeCell change={plsPrice.priceChange24h} />
                      </td>
                      <td className="text-right py-3 px-2 text-sm text-muted-foreground">{formatCompact(plsPrice.volume24h)}</td>
                      <td className="text-right py-3 px-2 text-sm text-muted-foreground">{formatCompact(plsPrice.liquidity)}</td>
                      <td className="text-right py-3 px-2 text-sm text-muted-foreground">{formatCompact(plsPrice.marketCap)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LP Pairs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Droplets className="w-5 h-5 text-[var(--hero-green)]" />
              HERO LP Pairs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground animate-pulse">Loading...</div>
            ) : market?.heroLpPairs && market.heroLpPairs.length > 0 ? (
              <div className="space-y-3">
                {market.heroLpPairs.map((pair) => (
                  <div key={pair.pairAddress} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{pair.baseToken.symbol}/{pair.quoteToken.symbol}</p>
                      <p className="text-xs text-muted-foreground">{pair.dexId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{formatCompact(pair.liquidity.usd)}</p>
                      <p className="text-xs text-muted-foreground">Vol: {formatCompact(pair.volume24h)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No LP pairs found</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="w-5 h-5 text-[var(--hero-orange)]" />
              VETS LP Pairs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground animate-pulse">Loading...</div>
            ) : market?.vetsLpPairs && market.vetsLpPairs.length > 0 ? (
              <div className="space-y-3">
                {market.vetsLpPairs.map((pair) => (
                  <div key={pair.pairAddress} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{pair.baseToken.symbol}/{pair.quoteToken.symbol}</p>
                      <p className="text-xs text-muted-foreground">{pair.dexId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{formatCompact(pair.liquidity.usd)}</p>
                      <p className="text-xs text-muted-foreground">Vol: {formatCompact(pair.volume24h)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No LP pairs found</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 24h Transaction Activity */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--hero-green)]" />
            24h Transaction Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground mb-1">HERO Buys</p>
              <p className="text-lg font-bold text-[var(--hero-green)]">{heroPrice?.txns24h?.buys ?? "—"}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground mb-1">HERO Sells</p>
              <p className="text-lg font-bold text-destructive">{heroPrice?.txns24h?.sells ?? "—"}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground mb-1">VETS Buys</p>
              <p className="text-lg font-bold text-[var(--hero-green)]">{vetsPrice?.txns24h?.buys ?? "—"}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary">
              <p className="text-xs text-muted-foreground mb-1">VETS Sells</p>
              <p className="text-lg font-bold text-destructive">{vetsPrice?.txns24h?.sells ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PriceChangeCell({ change }: { change: number | undefined | null }) {
  const { text, positive } = formatChange(change);
  return (
    <span className={`text-sm font-medium flex items-center justify-end gap-0.5 ${positive ? "text-[var(--hero-green)]" : "text-destructive"}`}>
      {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {text}
    </span>
  );
}
