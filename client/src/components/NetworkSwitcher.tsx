import { useEffect } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import { PULSECHAIN_ID, BASE_CHAIN_ID, type SupportedChainId } from "@shared/tokens";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function NetworkSwitcher({ compact = false }: { compact?: boolean }) {
  const {
    chainId,
    chain,
    supportedChains,
    switchNetwork,
    isSwitching,
    networkSwitchError,
    isUnsupportedChain,
  } = useNetwork();

  // Surface wallet rejection as a toast — fires whenever error changes
  useEffect(() => {
    if (networkSwitchError) {
      toast.error(networkSwitchError, { id: "network-switch-error" });
    }
  }, [networkSwitchError]);

  // DRY helper: toggle between the two chains
  const toggleChain = () =>
    switchNetwork(chainId === PULSECHAIN_ID ? BASE_CHAIN_ID : PULSECHAIN_ID);

  // ── Wrong-chain warning (connected wallet on unsupported network) ────
  if (isUnsupportedChain) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-1.5 text-xs font-medium text-yellow-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Wrong network</span>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={toggleChain}
        disabled={isSwitching}
        className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/50 px-2.5 py-1.5 text-xs font-medium transition-all hover:bg-card hover:border-border disabled:opacity-50"
        title={`Switch to ${chainId === PULSECHAIN_ID ? "Base" : "PulseChain"}`}
      >
        {isSwitching ? (
          <Loader2 className="h-3 w-3 animate-spin text-hero-orange" />
        ) : (
          <span className="text-sm">{chain.icon}</span>
        )}
        <span className="text-foreground/80">{chain.shortName}</span>
        <svg
          className="h-3 w-3 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card/30 p-1">
      {supportedChains.map((c) => {
        const isActive = c.id === chainId;
        return (
          <button
            key={c.id}
            onClick={() => switchNetwork(c.id as SupportedChainId)}
            disabled={isSwitching}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-50 ${
              isActive
                ? "bg-gradient-to-r from-hero-orange/20 to-hero-green/20 text-foreground border border-hero-orange/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            <span className="text-base">{c.icon}</span>
            <span>{c.shortName}</span>
            {isActive && !isSwitching && (
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: c.color }}
              />
            )}
            {isActive && isSwitching && (
              <Loader2 className="h-3 w-3 animate-spin text-hero-orange" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function NetworkBadge() {
  const { chain, isUnsupportedChain } = useNetwork();

  if (isUnsupportedChain) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border border-yellow-500/40 bg-yellow-500/10 text-yellow-400">
        <AlertTriangle className="h-3 w-3" />
        Wrong network
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border"
      style={{
        borderColor: `${chain.color}40`,
        backgroundColor: `${chain.color}10`,
        color: chain.color,
      }}
    >
      <span>{chain.icon}</span>
      {chain.name}
    </span>
  );
}
