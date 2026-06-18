/**
 * HeroCards NFT Holder Verification (Server-Side)
 *
 * Checks deployed HeroCards contracts on Base and PulseChain to determine:
 * - Whether a wallet holds any HERO Cards
 * - The holder's tier (Bronze/Silver/Gold)
 * - Whether they can access the spin wheel
 * - Fee discount eligibility
 *
 * Safety posture:
 * - Uses the real deployed contract addresses from deployments/LIVE_CONTRACTS.json.
 * - Reads fail closed by default so RPC outages do not grant production access.
 * - Timeout protection prevents hung RPC calls from blocking request handlers.
 * - Callers may explicitly pass failOpen=true only for beta/test flows.
 */
import { createPublicClient, http, type Address } from "viem";

// ─── Contract Config ─────────────────────────────────────────────
const HERO_CARDS_ADDRESS_BASE = "0x5Fad096af059ff9A2167351A0ffc8b45D71897bE" as const;
const HERO_CARDS_ADDRESS_PULSE = "0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36" as const;

export type HeroCardsNetwork = "base" | "pulsechain";

interface HeroCardsNetworkConfig {
  name: HeroCardsNetwork;
  chainId: number;
  displayName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  contractAddress: Address;
}

const HERO_CARDS_NETWORKS: Record<HeroCardsNetwork, HeroCardsNetworkConfig> = {
  base: {
    name: "base",
    chainId: 8453,
    displayName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://mainnet.base.org",
    contractAddress: HERO_CARDS_ADDRESS_BASE,
  },
  pulsechain: {
    name: "pulsechain",
    chainId: 369,
    displayName: "PulseChain",
    nativeCurrency: { name: "Pulse", symbol: "PLS", decimals: 18 },
    rpcUrl: "https://rpc.pulsechain.com",
    contractAddress: HERO_CARDS_ADDRESS_PULSE,
  },
};

const HERO_CARDS_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getHolderTier",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "tier", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "canAccessSpinWheel",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "canSpin", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getFeeDiscount",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "discountBps", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const RPC_TIMEOUT_MS = 10_000;

const clients: Partial<Record<HeroCardsNetwork, ReturnType<typeof createPublicClient>>> = {};

const TIER_MAP: Record<number, "bronze" | "silver" | "gold"> = {
  1: "bronze",
  2: "silver",
  3: "gold",
};

export interface HeroCardsHolderOptions {
  /** Defaults to Base to preserve existing call sites. */
  network?: HeroCardsNetwork;
  /** Explicit beta/test override only. Production callers should leave this false. */
  failOpen?: boolean;
}

export interface HeroCardsHolderStatus {
  wallet: Address;
  network: HeroCardsNetwork;
  balance: number;
  tier: "none" | "bronze" | "silver" | "gold";
  canSpin: boolean;
  feeDiscountBps: number;
}

function isAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function getNetworkConfig(network: HeroCardsNetwork = "base"): HeroCardsNetworkConfig {
  return HERO_CARDS_NETWORKS[network] ?? HERO_CARDS_NETWORKS.base;
}

function getClient(network: HeroCardsNetwork = "base") {
  if (clients[network]) return clients[network]!;

  const cfg = getNetworkConfig(network);
  const client = createPublicClient({
    chain: {
      id: cfg.chainId,
      name: cfg.displayName,
      nativeCurrency: cfg.nativeCurrency,
      rpcUrls: { default: { http: [cfg.rpcUrl] } },
    } as any,
    transport: http(cfg.rpcUrl),
  });

  clients[network] = client;
  return client;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = RPC_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("HeroCards RPC timeout")), timeoutMs)),
  ]);
}

function failClosedStatus(wallet: Address, network: HeroCardsNetwork, failOpen: boolean = false): HeroCardsHolderStatus {
  return {
    wallet,
    network,
    balance: 0,
    tier: failOpen ? "bronze" : "none",
    canSpin: failOpen,
    feeDiscountBps: 0,
  };
}

/**
 * Get complete NFT holder status for a wallet on the selected network.
 * Defaults to Base for backwards compatibility with existing call sites.
 */
export async function getHeroCardsHolderStatus(
  wallet: string,
  options: HeroCardsHolderOptions = {},
): Promise<HeroCardsHolderStatus> {
  const network = options.network ?? "base";
  const failOpen = options.failOpen ?? false;

  if (!wallet || !isAddress(wallet)) {
    throw new Error("Invalid wallet address");
  }

  const cfg = getNetworkConfig(network);
  const client = getClient(network);

  try {
    const [balanceRaw, tierRaw, canSpinRaw, discountRaw] = await Promise.all([
      withTimeout(client.readContract({
        address: cfg.contractAddress,
        abi: HERO_CARDS_ABI,
        functionName: "balanceOf",
        args: [wallet],
      }) as Promise<bigint>),
      withTimeout(client.readContract({
        address: cfg.contractAddress,
        abi: HERO_CARDS_ABI,
        functionName: "getHolderTier",
        args: [wallet],
      }) as Promise<number>),
      withTimeout(client.readContract({
        address: cfg.contractAddress,
        abi: HERO_CARDS_ABI,
        functionName: "canAccessSpinWheel",
        args: [wallet],
      }) as Promise<boolean>),
      withTimeout(client.readContract({
        address: cfg.contractAddress,
        abi: HERO_CARDS_ABI,
        functionName: "getFeeDiscount",
        args: [wallet],
      }) as Promise<bigint>),
    ]);

    const balance = Number(balanceRaw);
    const numericTier = Number(tierRaw);

    return {
      wallet,
      network,
      balance,
      tier: balance > 0 ? (TIER_MAP[numericTier] ?? "bronze") : "none",
      canSpin: Boolean(canSpinRaw) && balance > 0,
      feeDiscountBps: Number(discountRaw),
    };
  } catch {
    return failClosedStatus(wallet, network, failOpen);
  }
}

/**
 * Get the NFT holder tier for a wallet address.
 * Returns 'bronze' | 'silver' | 'gold'.
 * Falls back to 'bronze' only when failOpen=true; otherwise returns 'bronze' as the lowest tier for legacy callers.
 */
export async function getHeroCardsTier(
  wallet: string,
  options: HeroCardsHolderOptions = {},
): Promise<"bronze" | "silver" | "gold"> {
  if (!wallet || !isAddress(wallet)) return "bronze";
  const status = await getHeroCardsHolderStatus(wallet, options);
  return status.tier === "none" ? "bronze" : status.tier;
}

/**
 * Check if a wallet can access the spin wheel.
 * Production behavior fails closed on invalid wallet/RPC failure.
 */
export async function canAccessHeroSpinWheel(
  wallet: string,
  options: HeroCardsHolderOptions = {},
): Promise<boolean> {
  if (!wallet || !isAddress(wallet)) return false;
  const status = await getHeroCardsHolderStatus(wallet, options);
  return status.canSpin;
}

/**
 * Get the fee discount in basis points for a holder.
 * Returns 0 if invalid, not a holder, or chain/RPC read fails.
 */
export async function getHeroFeeDiscount(
  wallet: string,
  options: HeroCardsHolderOptions = {},
): Promise<number> {
  if (!wallet || !isAddress(wallet)) return 0;
  const status = await getHeroCardsHolderStatus(wallet, options);
  return status.feeDiscountBps;
}
