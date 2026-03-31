import { WagmiProvider as WagmiProviderBase } from "wagmi";
import { wagmiConfig } from "../lib/wagmi";
import type { ReactNode } from "react";

export function WagmiAppProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProviderBase config={wagmiConfig}>
      {children}
    </WagmiProviderBase>
  );
}
