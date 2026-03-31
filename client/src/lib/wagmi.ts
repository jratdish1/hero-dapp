import { http, createConfig } from "wagmi";
import type { Chain } from "viem";
import { injected } from "wagmi";
import { metaMask, coinbaseWallet } from "@wagmi/connectors";

// ─── PulseChain Definition ──────────────────────────────────────────────
export const pulsechain = {
  id: 369,
  name: "PulseChain",
  nativeCurrency: { name: "Pulse", symbol: "PLS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.pulsechain.com"] },
  },
  blockExplorers: {
    default: { name: "PulseScan", url: "https://scan.pulsechain.com" },
  },
} as const satisfies Chain;

// ─── Base Chain Definition ──────────────────────────────────────────────
export const base = {
  id: 8453,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.base.org"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://basescan.org" },
  },
} as const satisfies Chain;

// ─── Wagmi Config ───────────────────────────────────────────────────────
export const wagmiConfig = createConfig({
  chains: [pulsechain, base],
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({ appName: "HERO Dapp" }),
  ],
  transports: {
    [pulsechain.id]: http("https://rpc.pulsechain.com"),
    [base.id]: http("https://mainnet.base.org"),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
