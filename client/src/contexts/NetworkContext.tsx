import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
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

interface NetworkContextValue {
  chainId: SupportedChainId;
  chain: ChainConfig;
  tokens: TokenInfo[];
  dexSources: DexSource[];
  supportedChains: ChainConfig[];
  isPulseChain: boolean;
  isBase: boolean;
  switchChain: (chainId: SupportedChainId) => void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [chainId, setChainId] = useState<SupportedChainId>(PULSECHAIN_ID);

  const switchChain = useCallback((newChainId: SupportedChainId) => {
    setChainId(newChainId);
  }, []);

  const value: NetworkContextValue = {
    chainId,
    chain: CHAIN_MAP[chainId],
    tokens: TOKEN_MAP[chainId] ?? [],
    dexSources: DEX_MAP[chainId] ?? [],
    supportedChains: SUPPORTED_CHAINS,
    isPulseChain: chainId === PULSECHAIN_ID,
    isBase: chainId === BASE_CHAIN_ID,
    switchChain,
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
