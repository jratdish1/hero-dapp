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
import { ArrowDownUp, Zap, Info, RefreshCw, Settings2, ChevronDown } from "lucide-react";
import { FEATURED_TOKENS, DEX_SOURCES, type TokenInfo } from "../../../shared/tokens";

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

export default function Swap() {
  const [tokenIn, setTokenIn] = useState<TokenInfo>(FEATURED_TOKENS[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo>(FEATURED_TOKENS[1]);
  const [amountIn, setAmountIn] = useState("");
  const [gaslessMode, setGaslessMode] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [showSettings, setShowSettings] = useState(false);

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

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Swap</h1>
          <p className="text-sm text-muted-foreground">Trade tokens on PulseChain</p>
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

      {/* Quick token row */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {FEATURED_TOKENS.slice(0, 6).map((t) => (
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
              <span className="text-xs text-muted-foreground">Balance: 0.00</span>
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
                tokens={FEATURED_TOKENS}
                label="From"
              />
            </div>
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
              <span className="text-xs text-muted-foreground">Balance: 0.00</span>
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
                tokens={FEATURED_TOKENS}
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
                <span className="text-foreground">PulseX V2</span>
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
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-[var(--hero-orange)] to-[var(--hero-green)] hover:opacity-90 text-white border-0"
            disabled={!amountIn || parseFloat(amountIn) <= 0}
            onClick={() => {
              // Will integrate wallet connect
              import("sonner").then(({ toast }) => {
                toast.info("Connect your wallet to swap", {
                  description: "Wallet connection coming soon",
                });
              });
            }}
          >
            {!amountIn || parseFloat(amountIn) <= 0
              ? "Enter an amount"
              : "Connect Wallet to Swap"}
          </Button>
        </CardContent>
      </Card>

      {/* DEX sources */}
      <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <span>Aggregating from:</span>
        {DEX_SOURCES.map((dex) => (
          <span key={dex.id} className="px-2 py-1 rounded bg-secondary">
            {dex.name}
          </span>
        ))}
      </div>
    </div>
  );
}
