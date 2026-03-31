import { http, createConfig } from "wagmi";
import type { Chain } from "viem";
import { injected } from "wagmi";
import {
  metaMask,
  coinbaseWallet,
  walletConnect,
  safe,
} from "@wagmi/connectors";

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

// ─── WalletConnect Project ID ───────────────────────────────────────────
// Get a free Project ID at https://cloud.reown.com
// Set via VITE_WALLETCONNECT_PROJECT_ID environment variable
const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

// ─── Build Connectors ───────────────────────────────────────────────────
// Always include core connectors; WalletConnect only if Project ID is set
const connectorList = [
  // Injected — catches any browser-extension wallet (MetaMask, Rabby, Brave, etc.)
  injected(),
  // MetaMask — dedicated deep-link + SDK connector
  metaMask(),
  // Coinbase Wallet — browser extension + mobile deep-link
  coinbaseWallet({ appName: "HERO Dapp" }),
  // Safe (Gnosis Safe) — for multisig/DAO treasury wallets
  safe(),
];

// Only add WalletConnect if a Project ID is configured
// WalletConnect enables: Trust Wallet, Ledger, Trezor, Rainbow, 300+ mobile wallets
if (wcProjectId) {
  connectorList.push(
    walletConnect({
      projectId: wcProjectId,
      metadata: {
        name: "HERO Dapp",
        description:
          "PulseChain & BASE DEX Aggregator — Built for Veterans by Veterans",
        url: "https://www.herobase.io",
        icons: ["https://www.herobase.io/favicon.ico"],
      },
      showQrModal: true,
    })
  );
}

// ─── Wagmi Config ───────────────────────────────────────────────────────
export const wagmiConfig = createConfig({
  chains: [pulsechain, base],
  connectors: connectorList,
  transports: {
    [pulsechain.id]: http("https://rpc.pulsechain.com"),
    [base.id]: http("https://mainnet.base.org"),
  },
});

// ─── Export helpers ─────────────────────────────────────────────────────
export const hasWalletConnect = Boolean(wcProjectId);

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
