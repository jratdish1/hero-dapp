import { http, fallback, createConfig } from "wagmi";
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
    default: {
      http: [
        "https://rpc-pulsechain.g4mm4.io",
        "https://rpc.pulsechain.com",
        "https://pulsechain-rpc.publicnode.com",
      ],
    },
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
    default: {
      http: [
        "https://mainnet.base.org",
        "https://base-rpc.publicnode.com",
        "https://1rpc.io/base",
      ],
    },
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

// ─── RPC Failsafe Configuration ────────────────────────────────────────
// Using viem's `fallback` transport: if primary RPC fails or times out,
// automatically falls through to the next RPC in the list.
// Each http() transport has a 10s timeout. If it fails, next one is tried.
// This ensures the dapp stays functional even if one RPC provider goes down.

const pulseChainTransport = fallback([
  http("https://rpc-pulsechain.g4mm4.io", {
    timeout: 10_000,
    retryCount: 1,
    retryDelay: 500,
  }),
  http("https://rpc.pulsechain.com", {
    timeout: 10_000,
    retryCount: 1,
    retryDelay: 500,
  }),
  http("https://pulsechain-rpc.publicnode.com", {
    timeout: 12_000,
    retryCount: 1,
    retryDelay: 1000,
  }),
]);

const baseTransport = fallback([
  http("https://mainnet.base.org", {
    timeout: 10_000,
    retryCount: 1,
    retryDelay: 500,
  }),
  http("https://base-rpc.publicnode.com", {
    timeout: 10_000,
    retryCount: 1,
    retryDelay: 500,
  }),
  http("https://1rpc.io/base", {
    timeout: 12_000,
    retryCount: 1,
    retryDelay: 1000,
  }),
]);

// ─── Wagmi Config ───────────────────────────────────────────────────────
// SECURITY: reconnectOnMount disabled — users must explicitly click
// "Connect Wallet" each session. This prevents auto-connecting to
// potentially compromised or stale wallet sessions.
export const wagmiConfig = createConfig({
  chains: [pulsechain, base],
  connectors: connectorList,
  transports: {
    [pulsechain.id]: pulseChainTransport,
    [base.id]: baseTransport,
  },
  // Explicitly disable auto-reconnect on page load
  // Users must manually connect their wallet each session
  // This is a security best practice for DeFi applications
  storage: null,
});

// ─── Export helpers ─────────────────────────────────────────────────────
export const hasWalletConnect = Boolean(wcProjectId);

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
