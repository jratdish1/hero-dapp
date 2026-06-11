import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  PULSECHAIN_ID,
  BASE_CHAIN_ID,
  SUPPORTED_CHAINS,
  TOKEN_MAP,
  DEX_MAP,
  CHAIN_MAP,
  type SupportedChainId,
  type TokenInfo,
  type DexSource,
  type ChainConfig,
} from "@shared/tokens";
import { useAccount, useSwitchChain } from "wagmi";

// ─── DRY: Single source of truth for network state ─────────────────────
interface NetworkContextValue {
  chainId: SupportedChainId;
  chain: ChainConfig;
  tokens: TokenInfo[];
  dexSources: DexSource[];
  supportedChains: ChainConfig[];
  isPulseChain: boolean;
  isBase: boolean;
  /** Request a network switch. When connected, waits for wallet confirmation
   *  before updating UI chain. When disconnected, updates UI immediately for
   *  preview purposes. */
  switchNetwork: (chainId: SupportedChainId) => Promise<void>;
  isSwitching: boolean;
  /** Non-null when the wallet rejected or errored on a switch request. */
  networkSwitchError: string | null;
  /** True when the connected wallet is on a chain not in SUPPORTED_CHAINS. */
  isUnsupportedChain: boolean;
}

const SUPPORTED_IDS: number[] = [PULSECHAIN_ID, BASE_CHAIN_ID];

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  // UI chain — only used as source of truth when disconnected (preview mode).
  // When connected, walletChainId drives this via the useEffect below.
  const [chainId, setChainId] = useState<SupportedChainId>(PULSECHAIN_ID);
  const [networkSwitchError, setNetworkSwitchError] = useState<string | null>(null);

  const { isConnected, chainId: walletChainId } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  // ── Wallet chain is source of truth when connected ──────────────────
  // This is the ONLY place setChainId is called when a wallet is connected.
  useEffect(() => {
    if (isConnected && walletChainId) {
      if (SUPPORTED_IDS.includes(walletChainId)) {
        setChainId(walletChainId as SupportedChainId);
        setNetworkSwitchError(null);
      }
      // If unsupported chain: do NOT change chainId — keep last known good
      // value so balance reads don't break. isUnsupportedChain flag handles UI.
    }
  }, [isConnected, walletChainId]);

  // ── Derived: connected wallet is on an unsupported chain ────────────
  const isUnsupportedChain =
    isConnected &&
    walletChainId !== undefined &&
    !SUPPORTED_IDS.includes(walletChainId);

  // ── Switch handler ───────────────────────────────────────────────────
  // Connected: request wallet switch, do NOT update UI chain optimistically.
  //            UI chain only changes via the useEffect above after wallet confirms.
  // Disconnected: update UI immediately for preview.
  const switchNetwork = useCallback(
    async (newChainId: SupportedChainId): Promise<void> => {
      setNetworkSwitchError(null);

      if (!isConnected) {
        // Preview mode — no wallet, safe to flip UI immediately
        setChainId(newChainId);
        return;
      }

      if (!switchChainAsync) return;

      try {
        await switchChainAsync({ chainId: newChainId });
        // Success: walletChainId change triggers the useEffect → setChainId
      } catch (err: unknown) {
        // Wallet rejected or errored — UI chain stays unchanged (no optimistic flip)
        const msg =
          err instanceof Error ? err.message : "Wallet rejected network switch";
        // Trim wagmi's verbose error messages to something user-readable
        const clean = msg.includes("User rejected")
          ? "Switch rejected — wallet kept on current network."
          : msg.length > 120
            ? msg.slice(0, 120) + "…"
            : msg;
        setNetworkSwitchError(clean);
      }
    },
    [isConnected, switchChainAsync]
  );

  const value: NetworkContextValue = {
    chainId,
    chain: CHAIN_MAP[chainId],
    tokens: TOKEN_MAP[chainId] ?? [],
    dexSources: DEX_MAP[chainId] ?? [],
    supportedChains: SUPPORTED_CHAINS,
    isPulseChain: chainId === PULSECHAIN_ID,
    isBase: chainId === BASE_CHAIN_ID,
    switchNetwork,
    isSwitching,
    networkSwitchError,
    isUnsupportedChain,
  };

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within a NetworkProvider");
  return ctx;
}
