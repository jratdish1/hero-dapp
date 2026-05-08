import { useState } from "react";
import { Settings2, Shield, Zap, Clock, AlertTriangle } from "lucide-react";

interface SlippageSettingsProps {
  onSettingsChange?: (settings: SwapSettings) => void;
}

export interface SwapSettings {
  slippage: number;
  gasSpeed: "slow" | "standard" | "fast";
  mevProtection: boolean;
  deadline: number; // minutes
}

export default function SlippageSettings({ onSettingsChange }: SlippageSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [slippage, setSlippage] = useState(1.0);
  const [customSlippage, setCustomSlippage] = useState("");
  const [gasSpeed, setGasSpeed] = useState<"slow" | "standard" | "fast">("standard");
  const [mevProtection, setMevProtection] = useState(true);
  const [deadline, setDeadline] = useState(20);

  const presetSlippages = [0.5, 1.0, 3.0];

  const gasOptions = [
    { id: "slow" as const, label: "Slow", time: "~60s", cost: "$0.01" },
    { id: "standard" as const, label: "Standard", time: "~30s", cost: "$0.02" },
    { id: "fast" as const, label: "Fast", time: "~10s", cost: "$0.05" },
  ];

  const handleSlippageChange = (value: number) => {
    setSlippage(value);
    setCustomSlippage("");
    onSettingsChange?.({ slippage: value, gasSpeed, mevProtection, deadline });
  };

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0 && num <= 50) {
      setSlippage(num);
      onSettingsChange?.({ slippage: num, gasSpeed, mevProtection, deadline });
    }
  };

  const isHighSlippage = slippage > 5;
  const isLowSlippage = slippage < 0.3;

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Swap Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {slippage}% slippage • {gasSpeed} • {mevProtection ? "MEV protected" : "No MEV"}
          </span>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Settings panel */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50">
          {/* Slippage tolerance */}
          <div className="pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Slippage Tolerance
              </span>
              {isHighSlippage && (
                <span className="flex items-center gap-1 text-xs text-orange-400">
                  <AlertTriangle className="w-3 h-3" /> High slippage
                </span>
              )}
              {isLowSlippage && (
                <span className="flex items-center gap-1 text-xs text-yellow-400">
                  <AlertTriangle className="w-3 h-3" /> May fail
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {presetSlippages.map(preset => (
                <button
                  key={preset}
                  onClick={() => handleSlippageChange(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    slippage === preset && !customSlippage
                      ? "bg-[var(--hero-green)]/20 text-[var(--hero-green)] border border-[var(--hero-green)]/40"
                      : "bg-secondary text-muted-foreground border border-border/50 hover:border-border"
                  }`}
                >
                  {preset}%
                </button>
              ))}
              <div className="relative flex-1">
                <input
                  type="number"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippage(e.target.value)}
                  placeholder="Custom"
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--hero-green)]/50"
                  min="0.1"
                  max="50"
                  step="0.1"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* Gas speed */}
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Transaction Speed
            </span>
            <div className="grid grid-cols-3 gap-2">
              {gasOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => {
                    setGasSpeed(option.id);
                    onSettingsChange?.({ slippage, gasSpeed: option.id, mevProtection, deadline });
                  }}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg text-xs transition-all ${
                    gasSpeed === option.id
                      ? "bg-[var(--hero-green)]/10 border border-[var(--hero-green)]/40 text-[var(--hero-green)]"
                      : "bg-secondary border border-border/50 text-muted-foreground hover:border-border"
                  }`}
                >
                  {option.id === "slow" && <Clock className="w-3.5 h-3.5" />}
                  {option.id === "standard" && <Zap className="w-3.5 h-3.5" />}
                  {option.id === "fast" && <Zap className="w-3.5 h-3.5" />}
                  <span className="font-medium">{option.label}</span>
                  <span className="text-[10px] opacity-70">{option.time} • {option.cost}</span>
                </button>
              ))}
            </div>
          </div>

          {/* MEV Protection */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${mevProtection ? "text-[var(--hero-green)]" : "text-muted-foreground"}`} />
              <div>
                <span className="text-xs font-medium text-foreground">MEV Protection</span>
                <p className="text-[10px] text-muted-foreground">Prevents sandwich attacks on your swap</p>
              </div>
            </div>
            <button
              onClick={() => {
                setMevProtection(!mevProtection);
                onSettingsChange?.({ slippage, gasSpeed, mevProtection: !mevProtection, deadline });
              }}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                mevProtection ? "bg-[var(--hero-green)]" : "bg-secondary"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  mevProtection ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Transaction deadline */}
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Transaction Deadline
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={deadline}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 20;
                  setDeadline(val);
                  onSettingsChange?.({ slippage, gasSpeed, mevProtection, deadline: val });
                }}
                className="w-20 px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border/50 text-foreground focus:outline-none focus:border-[var(--hero-green)]/50"
                min="1"
                max="60"
              />
              <span className="text-xs text-muted-foreground">minutes</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
