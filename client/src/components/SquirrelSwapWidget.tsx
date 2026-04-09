import { useState } from "react";
import { ExternalLink, Info, Zap } from "lucide-react";

// HERO token contract addresses
const HERO_PULSECHAIN = "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27"; // PulseChain HERO CA
const HERO_BASE = "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8";

// Military HERO theme colors for SquirrelSwap widget
const HERO_THEME = {
  accentColor: "C8A84B",      // Military gold
  cardColor: "1C2A1C",        // Dark military green
  bgColor: "transparent",
  borderColor: "3D5A3D",      // Medium military green
  textColor: "E8E8D0",        // Light khaki
};

// Li.Fi widget config for BASE network (supports Aerodrome + Uniswap)
const LIFI_BASE_URL = `https://transferto.xyz/embed?fromChain=8453&toChain=8453&toToken=${HERO_BASE}&theme=dark`;

interface SquirrelSwapWidgetProps {
  defaultChain?: "pulsechain" | "base";
  modes?: string; // "swap,limit,dca,batch"
  showChainToggle?: boolean;
  compact?: boolean;
}

export default function SquirrelSwapWidget({
  defaultChain = "pulsechain",
  modes = "swap,limit,dca",
  showChainToggle = true,
  compact = false,
}: SquirrelSwapWidgetProps) {
  const [activeChain, setActiveChain] = useState<"pulsechain" | "base">(defaultChain);

  const squirrelUrl = [
    `https://app.squirrelswap.pro/#/widget`,
    `?modes=${modes}`,
    `&tokenOut=${HERO_PULSECHAIN}`,
    `&accentColor=${HERO_THEME.accentColor}`,
    `&bgColor=0d1a0d`,
    `&cardColor=${HERO_THEME.cardColor}`,
    `&borderColor=${HERO_THEME.borderColor}`,
    `&textColor=${HERO_THEME.textColor}`,
  ].join("");

  const height = compact ? "520" : "620";

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Chain toggle */}
      {showChainToggle && (
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #3D5A3D" }}
        >
          <button
            onClick={() => setActiveChain("pulsechain")}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
            style={
              activeChain === "pulsechain"
                ? {
                    background: "linear-gradient(135deg, #C8A84B, #a8882b)",
                    color: "#0d1a0d",
                    boxShadow: "0 2px 12px rgba(200,168,75,0.3)",
                  }
                : { color: "#8a9a8a" }
            }
          >
            ⚡ PulseChain
          </button>
          <button
            onClick={() => setActiveChain("base")}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
            style={
              activeChain === "base"
                ? {
                    background: "linear-gradient(135deg, #C8A84B, #a8882b)",
                    color: "#0d1a0d",
                    boxShadow: "0 2px 12px rgba(200,168,75,0.3)",
                  }
                : { color: "#8a9a8a" }
            }
          >
            🔵 BASE
          </button>
        </div>
      )}

      {/* Widget container */}
      <div
        className="w-full rounded-2xl overflow-hidden relative"
        style={{
          maxWidth: "480px",
          border: "1px solid #3D5A3D",
          boxShadow: "0 0 30px rgba(200,168,75,0.08)",
        }}
      >
        {activeChain === "pulsechain" ? (
          <iframe
            src={squirrelUrl}
            width="100%"
            height={height}
            style={{ border: "none", borderRadius: "16px", display: "block" }}
            allow="clipboard-write"
            title="SquirrelSwap — HERO PulseChain"
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-4 p-8 text-center"
            style={{ minHeight: `${height}px`, background: "#1C2A1C" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(200,168,75,0.15)", border: "1px solid rgba(200,168,75,0.3)" }}
            >
              <Zap className="w-8 h-8" style={{ color: "#C8A84B" }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Swap HERO on BASE</h3>
              <p className="text-sm mb-4" style={{ color: "#8a9a8a" }}>
                HERO is available on Aerodrome and Uniswap V3 on BASE network.
                Use the aggregator below for best rates.
              </p>
              <p className="text-xs mb-6" style={{ color: "#5a6a5a" }}>
                HERO CA: <span style={{ color: "#C8A84B", fontFamily: "monospace" }}>0x00Fa69...b5f8</span>
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <a
                href={`https://aerodrome.finance/swap?from=ETH&to=${HERO_BASE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #C8A84B, #a8882b)",
                  color: "#0d1a0d",
                }}
              >
                <ExternalLink className="w-4 h-4" />
                Swap on Aerodrome (Best Rates)
              </a>
              <a
                href={`https://app.uniswap.org/swap?outputCurrency=${HERO_BASE}&chain=base`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                style={{
                  background: "rgba(200,168,75,0.1)",
                  border: "1px solid rgba(200,168,75,0.3)",
                  color: "#C8A84B",
                }}
              >
                <ExternalLink className="w-4 h-4" />
                Swap on Uniswap V3
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Powered by label */}
      <div className="flex items-center gap-2 text-xs" style={{ color: "#5a6a5a" }}>
        {activeChain === "pulsechain" ? (
          <>
            <span>Powered by</span>
            <a
              href="https://app.squirrelswap.pro"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "#C8A84B" }}
            >
              SquirrelSwap
            </a>
            <span>— 12 DEX aggregator</span>
          </>
        ) : (
          <>
            <span>Available on</span>
            <span style={{ color: "#C8A84B" }}>Aerodrome + Uniswap V3</span>
            <span>on BASE</span>
          </>
        )}
      </div>
    </div>
  );
}
