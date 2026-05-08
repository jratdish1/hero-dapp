import { useState, useCallback } from "react";
import { Settings2, Shield, Zap, Clock, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SwapSettings {
  slippage: number;
  gasSpeed: "slow" | "standard" | "fast";
  mevProtection: boolean;
  deadline: number;
}

interface GasOption {
  id: "slow" | "standard" | "fast";
  label: string;
  icon: typeof Clock;
  time: string;
  cost: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SLIPPAGE_PRESETS = [0.5, 1, 3];
const MAX_SLIPPAGE = 50; // Cap at 50% to prevent catastrophic losses
const SLIPPAGE_WARNING_THRESHOLD = 5;

const GAS_OPTIONS: GasOption[] = [
  { id: "slow", label: "Slow", icon: Clock, time: "~5 min", cost: "$0.01" },
  { id: "standard", label: "Standard", icon: Zap, time: "~30 sec", cost: "$0.03" },
  { id: "fast", label: "Fast", icon: Zap, time: "~10 sec", cost: "$0.05" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function SlippageSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [customSlippage, setCustomSlippage] = useState("");
  const [settings, setSettings] = useState<SwapSettings>({
    slippage: 1,
    gasSpeed: "standard",
    mevProtection: true,
    deadline: 20,
  });

  const handleSlippagePreset = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, slippage: value }));
    setCustomSlippage("");
  }, []);

  const handleCustomSlippage = useCallback((value: string) => {
    // Normalize decimal separator
    const normalizedValue = value.replace(",", ".");
    setCustomSlippage(value);
    const num = parseFloat(normalizedValue);
    if (!isNaN(num) && num > 0 && num <= MAX_SLIPPAGE) {
      setSettings((prev) => ({ ...prev, slippage: num }));
    }
  }, []);

  const toggleMevProtection = useCallback(() => {
    setSettings((prev) => ({ ...prev, mevProtection: !prev.mevProtection }));
  }, []);

  const handleDeadlineChange = useCallback((value: number) => {
    const val = Math.min(Math.max(value, 1), 60);
    setSettings((prev) => ({ ...prev, deadline: val }));
  }, []);

  const handleGasSpeed = useCallback((id: "slow" | "standard" | "fast") => {
    setSettings((prev) => ({ ...prev, gasSpeed: id }));
  }, []);

  const showSlippageWarning = settings.slippage >= SLIPPAGE_WARNING_THRESHOLD;

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="swap-settings-panel"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Swap Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {settings.slippage}% slippage • {settings.gasSpeed} • {settings.mevProtection ? "MEV protected" : "unprotected"}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Settings panel */}
      {isOpen && (
        <div id="swap-settings-panel" className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
          {/* Slippage tolerance */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Slippage Tolerance</label>
            <div className="flex items-center gap-2">
              {SLIPPAGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleSlippagePreset(preset)}
                  aria-pressed={settings.slippage === preset && customSlippage === ""}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    settings.slippage === preset && customSlippage === ""
                      ? "bg-[var(--hero-green)]/20 text-[var(--hero-green)] border border-[var(--hero-green)]/40"
                      : "bg-secondary/50 text-muted-foreground border border-border/50 hover:bg-secondary"
                  }`}
                >
                  {preset}%
                </button>
              ))}
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="number"
                  inputMode="decimal"
                  id="custom-slippage"
                  aria-label="Custom slippage tolerance percentage"
                  placeholder="Custom"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippage(e.target.value)}
                  min="0.1"
                  max={MAX_SLIPPAGE}
                  step="0.1"
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--hero-green)]/50"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            {/* High slippage warning */}
            {showSlippageWarning && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <AlertTriangle className="w-3 h-3 text-orange-400 flex-shrink-0" />
                <span className="text-[10px] text-orange-400">
                  High slippage ({settings.slippage}%) — you may receive significantly fewer tokens. Max allowed: {MAX_SLIPPAGE}%.
                </span>
              </div>
            )}
          </div>

          {/* Gas speed */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Gas Speed</label>
            <div className="grid grid-cols-3 gap-2">
              {GAS_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleGasSpeed(option.id)}
                  aria-pressed={settings.gasSpeed === option.id}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                    settings.gasSpeed === option.id
                      ? "bg-[var(--hero-green)]/20 text-[var(--hero-green)] border border-[var(--hero-green)]/40"
                      : "bg-secondary/50 text-muted-foreground border border-border/50 hover:bg-secondary"
                  }`}
                >
                  <option.icon className="w-3.5 h-3.5" />
                  <span className="font-medium">{option.label}</span>
                  <span className="text-[10px] opacity-70">{option.time}</span>
                  <span className="text-[10px] opacity-70">{option.cost}</span>
                </button>
              ))}
            </div>
          </div>

          {/* MEV Protection */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${settings.mevProtection ? "text-[var(--hero-green)]" : "text-muted-foreground"}`} />
              <div>
                <span className="text-xs font-medium text-foreground">MEV Protection</span>
                <p className="text-[10px] text-muted-foreground">Prevents sandwich attacks on your swaps</p>
              </div>
            </div>
            <button
              onClick={toggleMevProtection}
              aria-pressed={settings.mevProtection}
              aria-label="Toggle MEV Protection"
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings.mevProtection ? "bg-[var(--hero-green)]" : "bg-secondary"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.mevProtection ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Transaction deadline */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">TX Deadline</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                aria-label="Transaction deadline in minutes"
                value={settings.deadline}
                onChange={(e) => handleDeadlineChange(parseInt(e.target.value) || 20)}
                min="1"
                max="60"
                className="w-14 px-2 py-1 rounded text-xs text-center bg-secondary/50 border border-border/50 text-foreground focus:outline-none focus:border-[var(--hero-green)]/50"
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
