import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
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
} from "../../../shared/tokens";
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
  switchNetwork: (chainId: SupportedChainId) => void;
  isSwitching: boolean;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [chainId, setChainId] = useState<SupportedChainId>(PULSECHAIN_ID);

  // wagmi hooks — bridge UI state with actual wallet chain
  const { isConnected, chainId: walletChainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  // Sync UI state when wallet reports a chain change
  useEffect(() => {
    if (isConnected && walletChainId) {
      const supported = [PULSECHAIN_ID, BASE_CHAIN_ID] as number[];
      if (supported.includes(walletChainId)) {
        setChainId(walletChainId as SupportedChainId);
      }
    }
  }, [isConnected, walletChainId]);

  // Switch both UI state AND wallet chain (if connected)
  const switchNetwork = useCallback(
    (newChainId: SupportedChainId) => {
      setChainId(newChainId);
      if (isConnected && switchChain) {
        try {
          switchChain({ chainId: newChainId });
        } catch {
          // Wallet may reject — UI state already updated for data display
        }
      }
    },
    [isConnected, switchChain]
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
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within a NetworkProvider");
  return ctx;
}
