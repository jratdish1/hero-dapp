import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDownUp, ArrowLeftRight, Zap, Info, Settings2, Loader2, TrendingUp, TrendingDown, ExternalLink, Shield, Clock } from "lucide-react";
import { type TokenInfo } from "@shared/tokens";
import { useNetwork } from "../contexts/NetworkContext";
import { NetworkBadge } from "../components/NetworkSwitcher";
import { useAccount } from "wagmi";
import { useTokenBalance, formatTokenBalance } from "../hooks/useTokenBalance";
import { useMarketOverview, formatPrice, formatChange } from "../hooks/usePrices";
import { toast } from "sonner";

function TokenSelector({
  selected,
  onSelect,
  tokens,
  label,
}: {
  selected: TokenInfo;
  onSelect: (t: TokenInfo) => void;
  tokens: TokenInfo[];
  label: string;
}) {
  return (
    <Select
      value={selected.address}
      onValueChange={(addr) => {
        const t = tokens.find((tk) => tk.address === addr);
        if (t) onSelect(t);
      }}
    >
      <SelectTrigger className="w-[180px] bg-secondary border-border h-12">
        <SelectValue>
          <div className="flex items-center gap-2">
            <img
              src={selected.logoURI}
              alt={selected.symbol}
              className="w-6 h-6 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${selected.symbol}&background=random&size=24`;
              }}
            />
            <span className="font-semibold">{selected.symbol}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        {tokens.map((t) => (
          <SelectItem key={t.address} value={t.address}>
            <div className="flex items-center gap-2">
              <img
                src={t.logoURI}
                alt={t.symbol}
                className="w-5 h-5 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${t.symbol}&background=random&size=20`;
                }}
              />
              <span className="font-medium">{t.symbol}</span>
              <span className="text-xs text-muted-foreground">{t.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LivePriceBanner() {
  const { data: market, isLoading } = useMarketOverview();
  if (isLoading || !market) return <div className="text-xs text-muted-foreground animate-pulse">Loading live prices...</div>;
  const items = [
    { symbol: "HERO", price: market.heroPrice?.priceUsd, change: market.heroPrice?.priceChange24h },
    { symbol: "VETS", price: market.vetsPrice?.priceUsd, change: market.vetsPrice?.priceChange24h },
    { symbol: "PLS", price: market.plsPrice?.priceUsd, change: market.plsPrice?.priceChange24h },
  ].filter(i => i.price);
  return (
    <div className="flex items-center gap-4 overflow-x-auto">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Live:</span>
      {items.map(i => {
        const { text, positive } = formatChange(i.change);
        return (
          <div key={i.symbol} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-xs font-semibold text-foreground">{i.symbol}</span>
            <span className="text-xs font-mono text-foreground">{formatPrice(i.price)}</span>
            <span className={`text-xs font-mono ${positive ? "text-white/90" : "text-white/70"}`}>{text}</span>
          </div>
        );
      })}
    </div>
  );
}

// SquirrelSwap Pro embeddable widget
// Docs: https://app.squirrelswap.pro/#/docs (API & Widget section)
function SquirrelWidget({ tokenOut }: { tokenOut?: string }) {
  const widgetSrc = [
    "https://app.squirrelswap.pro/#/widget",
    "?modes=swap,limit,dca",
    "&accentColor=e8b84b",
    "&bgColor=0d1a0d",
    "&cardColor=161825",
    "&borderColor=2a2b3d",
    "&textColor=e6edf3",
    tokenOut ? `&tokenOut=${tokenOut}` : "",
  ].join("");

  // Auto-resize the iframe when SquirrelSwap emits resize events
  const handleMessage = (e: MessageEvent) => {
    if (e.data?.type === "squirrelswap:resize") {
      const iframe = document.getElementById("squirrel-iframe") as HTMLIFrameElement | null;
      if (iframe) iframe.style.height = (e.data.height + 32) + "px";
    }
  };

  return (
    <iframe
      id="squirrel-iframe"
      src={widgetSrc}
      width="100%"
      height="620"
      style={{ border: "none", borderRadius: "16px", display: "block" }}
      allow="clipboard-write"
      title="SquirrelSwap Pro — PulseChain DEX Aggregator"
      onLoad={() => window.addEventListener("message", handleMessage)}
    />
  );
}

export default function Swap() {
  const { tokens, dexSources, chain, chainId } = useNetwork();
  const { address, isConnected } = useAccount();
  const [tokenIn, setTokenIn] = useState<TokenInfo>(tokens[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(tokens[1]);
  const [amountIn, setAmountIn] = useState("");
  const [gaslessMode, setGaslessMode] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [showSettings, setShowSettings] = useState(false);
  const [showSquirrel, setShowSquirrel] = useState(true);

  // Real on-chain balance reads
  const tokenInBalance = useTokenBalance(tokenIn.address, chainId, tokenIn.isNative);
  const tokenOutBalance = useTokenBalance(tokenOut.address, chainId, tokenOut.isNative);

  const estimatedOut = useMemo(() => {
    if (!amountIn || parseFloat(amountIn) <= 0) return "";
    return (parseFloat(amountIn) * 0.997).toFixed(6);
  }, [amountIn]);

  const handleSwapTokens = () => {
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
    setAmountIn("");
  };

  const handleSwap = () => {
    if (!isConnected) {
      toast.info("Connect your wallet first", {
        description: "Use the Connect Wallet button in the header",
      });
      return;
    }
    if (!amountIn || parseFloat(amountIn) <= 0) {
      toast.warning("Enter an amount to swap");
      return;
    }
    // Route to best DEX for this chain
    const isPulse = chainId === 369;
    const isBase = chainId === 8453;
    const tokenInAddr = tokenIn.address;
    const tokenOutAddr = tokenOut.address;
    if (isPulse) {
      // PulseX V2 swap URL
      const pulseXUrl = `https://app.pulsex.com/swap?inputCurrency=${tokenInAddr}&outputCurrency=${tokenOutAddr}`;
      toast.success(`Opening PulseX — ${amountIn} ${tokenIn.symbol} → ${tokenOut.symbol}`, {
        description: "Redirecting to PulseX for best execution...",
        action: { label: "Open", onClick: () => window.open(pulseXUrl, "_blank") },
      });
      setTimeout(() => window.open(pulseXUrl, "_blank"), 1200);
    } else if (isBase) {
      // Aerodrome swap URL for BASE
      const aeroUrl = `https://aerodrome.finance/swap?from=${tokenInAddr}&to=${tokenOutAddr}`;
      toast.success(`Opening Aerodrome — ${amountIn} ${tokenIn.symbol} → ${tokenOut.symbol}`, {
        description: "Redirecting to Aerodrome for best execution...",
        action: { label: "Open", onClick: () => window.open(aeroUrl, "_blank") },
      });
      setTimeout(() => window.open(aeroUrl, "_blank"), 1200);
    } else {
      toast.info("Select a network to swap", { description: "Use the PulseChain or BASE toggle above" });
    }
  };

  const getSwapButtonText = () => {
    if (!isConnected) return "Connect Wallet to Swap";
    if (!amountIn || parseFloat(amountIn) <= 0) return "Enter an amount";
    return `Swap ${tokenIn.symbol} → ${tokenOut.symbol}`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ═══ SQUIRREL SWAP PRO — TOP OF PAGE ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img
              src="https://iili.io/qdikIJj.png"
              alt="SquirrelSwap"
              className="w-6 h-6 rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <h2 className="text-lg font-bold text-foreground">SquirrelSwap Pro</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--hero-green)]/10 text-[var(--hero-green)] font-medium">
              Best Rates
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://app.squirrelswap.pro/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Open Full App <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => setShowSquirrel(!showSquirrel)}
              className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSquirrel ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {showSquirrel && (
          <Card className="bg-card border-border overflow-hidden">
            <div className="w-full" style={{ height: "680px" }}>
              <iframe
                src="https://app.squirrelswap.pro/#/widget?modes=swap,limit,dca&accentColor=e8b84b&bgColor=0d1a0d&cardColor=161825&borderColor=2a2b3d&textColor=e6edf3&tokenOut=0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27"
                className="w-full h-full border-0"
                title="SquirrelSwap Pro — PulseChain DEX Aggregator"
                allow="clipboard-write; clipboard-read"
  
                loading="lazy"
              />
            </div>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center mt-2">
          Aggregates 10 DEXes on PulseChain — PulseX, 9mm, 9inch, PHUX, pDEX & more
        </p>
      </div>

      {/* ═══ DIVIDER ═══ */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">HERO Swap</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* ═══ HERO NATIVE SWAP — BELOW ═══ */}
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Swap</h1>
            <p className="text-sm text-muted-foreground">Trade tokens on {chain.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live price banner */}
        <Card className="mb-4 bg-card border-border">
          <CardContent className="p-3">
            <LivePriceBanner />
          </CardContent>
        </Card>

        {/* Quick token row */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {tokens.slice(0, 6).map((t) => (
            <button
              key={t.address}
              onClick={() => setTokenIn(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
                tokenIn.address === t.address
                  ? "border-[var(--hero-orange)] bg-[var(--hero-orange)]/10 text-[var(--hero-orange)]"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <img
                src={t.logoURI}
                alt={t.symbol}
                className="w-4 h-4 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${t.symbol}&background=random&size=16`;
                }}
              />
              {t.symbol}
            </button>
          ))}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <Card className="mb-4 bg-card border-border">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-foreground">Slippage Tolerance</Label>
                <div className="flex gap-1">
                  {["0.1", "0.5", "1.0"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlippage(s)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        slippage === s
                          ? "bg-[var(--hero-orange)] text-[var(--hero-orange-foreground,#000)]"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}%
                    </button>
                  ))}
                  <Input
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                    className="w-16 h-7 text-xs text-center bg-secondary border-border"
                    placeholder="%"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[var(--hero-green)]" />
                  <Label className="text-sm text-foreground">Gasless Mode</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>ERC-4337 Paymaster covers gas fees. A small protocol fee is deducted from the swap amount instead.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={gaslessMode}
                  onCheckedChange={setGaslessMode}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Swap card */}
        <Card className="bg-card border-border hero-glow">
          <CardContent className="p-5 space-y-3">
            {/* You pay */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">You pay</span>
                <span className="text-xs text-muted-foreground">
                  Balance:{" "}
                  {isConnected && tokenInBalance.balance !== undefined ? (
                    <span className="text-foreground font-medium">
                      {tokenInBalance.isLoading ? (
                        <Loader2 className="inline w-3 h-3 animate-spin" />
                      ) : (
                        formatTokenBalance(tokenInBalance.balance, tokenIn.decimals)
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="flex gap-3 items-center bg-secondary rounded-xl p-3">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={amountIn}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9]*\.?[0-9]*$/.test(val)) setAmountIn(val);
                  }}
                  className="flex-1 bg-transparent border-none text-2xl font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-0 p-0 h-auto"
                />
                <TokenSelector
                  selected={tokenIn}
                  onSelect={setTokenIn}
                  tokens={tokens}
                  label="From"
                />
              </div>
              {/* MAX button when connected */}
              {isConnected && tokenInBalance.balance !== undefined && (
                <button
                  onClick={() => {
                    const bal = formatTokenBalance(tokenInBalance.balance, tokenIn.decimals, 8);
                    setAmountIn(bal);
                  }}
                  className="text-xs text-[var(--hero-orange)] hover:underline ml-1"
                >
                  MAX
                </button>
              )}
            </div>

            {/* Swap direction button */}
            <div className="flex justify-center -my-1 relative z-10">
              <button
                onClick={handleSwapTokens}
                className="w-10 h-10 rounded-xl bg-secondary border-2 border-background flex items-center justify-center text-muted-foreground hover:text-[var(--hero-orange)] hover:border-[var(--hero-orange)]/30 transition-all hover:rotate-180 duration-300"
              >
                <ArrowDownUp className="w-4 h-4" />
              </button>
            </div>

            {/* You receive */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">You receive</span>
                <span className="text-xs text-muted-foreground">
                  Balance:{" "}
                  {isConnected && tokenOutBalance.balance !== undefined ? (
                    <span className="text-foreground font-medium">
                      {tokenOutBalance.isLoading ? (
                        <Loader2 className="inline w-3 h-3 animate-spin" />
                      ) : (
                        formatTokenBalance(tokenOutBalance.balance, tokenOut.decimals)
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="flex gap-3 items-center bg-secondary rounded-xl p-3">
                <Input
                  type="text"
                  placeholder="0.0"
                  value={estimatedOut}
                  readOnly
                  className="flex-1 bg-transparent border-none text-2xl font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-0 p-0 h-auto"
                />
                <TokenSelector
                  selected={tokenOut}
                  onSelect={setTokenOut}
                  tokens={tokens}
                  label="To"
                />
              </div>
            </div>

            {/* Swap details */}
            {amountIn && parseFloat(amountIn) > 0 && (
              <div className="bg-secondary/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Rate</span>
                  <span className="text-foreground">
                    1 {tokenIn.symbol} ≈ 0.997 {tokenOut.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Slippage</span>
                  <span className="text-foreground">{slippage}%</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Route</span>
                  <span className="text-foreground">
                    {dexSources[0]?.name ?? "Best Route"}
                  </span>
                </div>
                {gaslessMode && (
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-[var(--hero-green)]" />
                      Gas Fee
                    </span>
                    <span className="text-[var(--hero-green)] font-medium">FREE (Gasless)</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Protocol Fee</span>
                  <span className="text-foreground">0.3%</span>
                </div>
              </div>
            )}

            {/* Gasless mode indicator */}
            {gaslessMode && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--hero-green)]/10 border border-[var(--hero-green)]/20">
                <Zap className="w-4 h-4 text-[var(--hero-green)]" />
                <span className="text-xs text-[var(--hero-green)]">
                  Gasless Mode — No gas required. Fees covered by protocol.
                </span>
              </div>
            )}

            {/* Swap button */}
            <Button
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] hover:opacity-90 text-foreground border-0"
              disabled={isConnected && (!amountIn || parseFloat(amountIn) <= 0)}
              onClick={handleSwap}
            >
              {getSwapButtonText()}
            </Button>

            {/* Connected wallet indicator */}
            {isConnected && address && (
              <div className="text-center text-xs text-muted-foreground">
                Connected: {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* DEX sources */}
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>Aggregating from:</span>
          {dexSources.map((dex: { id: string; name: string }) => (
            <span key={dex.id} className="px-2 py-1 rounded bg-secondary">
              {dex.name}
            </span>
          ))}
        </div>
      </div>

      {/* ═══ DIVIDER ═══ */}
      <div className="flex items-center gap-3 mt-8">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Cross-Chain Bridge</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* LibertySwap — Cross-Chain USDC Bridge (PulseChain ↔ BASE) */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗽</span>
            <h2 className="text-lg font-bold text-foreground">Liberty Swap</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--hero-green)]/10 text-[var(--hero-green)] border border-[var(--hero-green)]/20 font-medium">
              Cross-Chain · USDC Bridge
            </span>
          </div>
          <a
            href="https://libertyswap.finance/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Open Full App <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Bridge USDC between PulseChain and BASE — 1:1 rate, 0.3% fee, gasless mode available. Powered by Railgun privacy protocol.
        </p>
        <Card className="bg-card border-border overflow-hidden">
          <div className="p-6 space-y-6">
            {/* Bridge Visual */}
            <div className="flex items-center justify-center gap-4 py-6">
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary/50 border border-border min-w-[120px]">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-2xl">🔵</span>
                </div>
                <span className="text-sm font-semibold text-foreground">BASE</span>
                <span className="text-xs text-muted-foreground">USDC</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1 text-[var(--hero-green)]">
                  <ArrowLeftRight className="w-6 h-6" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">1:1 Rate</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary/50 border border-border min-w-[120px]">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-2xl">⚡</span>
                </div>
                <span className="text-sm font-semibold text-foreground">PulseChain</span>
                <span className="text-xs text-muted-foreground">USDC</span>
              </div>
            </div>
            {/* Features */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <Zap className="w-5 h-5 text-[var(--hero-green)]" />
                <span className="text-xs font-medium text-foreground">Gasless</span>
                <span className="text-[10px] text-muted-foreground text-center">No gas required</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <Shield className="w-5 h-5 text-[var(--hero-orange)]" />
                <span className="text-xs font-medium text-foreground">Private</span>
                <span className="text-[10px] text-muted-foreground text-center">Railgun protocol</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-medium text-foreground">2-3 min</span>
                <span className="text-[10px] text-muted-foreground text-center">Bridge time</span>
              </div>
            </div>
            {/* Fee info */}
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-secondary/20 border border-border/50">
              <span className="text-sm text-muted-foreground">Protocol Fee</span>
              <span className="text-sm font-semibold text-foreground">0.3%</span>
            </div>
            {/* CTA Button */}
            <a
              href="https://libertyswap.finance/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-gradient-to-r from-[var(--hero-green)] to-emerald-600 text-black font-bold text-base hover:opacity-90 transition-opacity"
            >
              <span>🗽</span> Open Liberty Swap <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Powered by Liberty Finance — Intent-based cross-chain swaps with Railgun privacy
        </p>
      </div>
    </div>
  );
}
