/**
 * HeroCards NFT Holder Verification (Server-Side)
 * 
 * Checks the HeroCards contract on Base chain to determine:
 * - Whether a wallet holds any HERO Cards
 * - The holder's tier (Bronze/Silver/Gold)
 * - Whether they can access the spin wheel
 * 
 * Used by the spin engine to gate access and determine wheel tier.
 * 
 * NOTE: Update HERO_CARDS_ADDRESS after contract deployment.
 */
import { createPublicClient, http } from "viem";

// ─── Contract Config ─────────────────────────────────────────────
// UPDATE THIS AFTER DEPLOYMENT
const HERO_CARDS_ADDRESS = "0x5Fad096af059ff9A2167351A0ffc8b45D71897bE" as `0x${string}`;
// PulseChain contract (same code, different chain)
const HERO_CARDS_ADDRESS_PULSE = "0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36" as `0x${string}`;

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

// ─── Base Chain Client ───────────────────────────────────────────
const baseClient = createPublicClient({
  chain: {
    id: 8453,
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["https://mainnet.base.org"] } },
  } as any,
  transport: http("https://mainnet.base.org"),
});

// ─── Tier Mapping ────────────────────────────────────────────────
const TIER_MAP: Record<number, 'bronze' | 'silver' | 'gold'> = {
  0: 'bronze', // No NFTs defaults to bronze (won't pass canAccessSpinWheel)
  1: 'bronze',
  2: 'silver',
  3: 'gold',
};

// ─── Public API ──────────────────────────────────────────────────

/**
 * Get the NFT holder tier for a wallet address.
 * Returns 'bronze' | 'silver' | 'gold'
 * Falls back to 'bronze' on RPC failure.
 */
export async function getHeroCardsTier(wallet: string): Promise<'bronze' | 'silver' | 'gold'> {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return 'bronze';
  if (HERO_CARDS_ADDRESS === "0x5Fad096af059ff9A2167351A0ffc8b45D71897bE") {
    // Contract not deployed yet — default to bronze
    return 'bronze';
  }
  
  try {
    const tier = await Promise.race([
      baseClient.readContract({
        address: HERO_CARDS_ADDRESS,
        abi: HERO_CARDS_ABI,
        functionName: "getHolderTier",
        args: [wallet as `0x${string}`],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10_000)),
    ]);
    return TIER_MAP[Number(tier)] || 'bronze';
  } catch {
    return 'bronze';
  }
}

/**
 * Check if a wallet can access the spin wheel (must hold at least 1 HERO Card).
 * Returns true if holder, false otherwise.
 * Falls back to true on RPC failure (graceful degradation).
 */
export async function canAccessHeroSpinWheel(wallet: string): Promise<boolean> {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return false;
  if (HERO_CARDS_ADDRESS === "0x5Fad096af059ff9A2167351A0ffc8b45D71897bE") {
    // Contract not deployed yet — allow access (beta mode)
    return true;
  }
  
  try {
    const canSpin = await Promise.race([
      baseClient.readContract({
        address: HERO_CARDS_ADDRESS,
        abi: HERO_CARDS_ABI,
        functionName: "canAccessSpinWheel",
        args: [wallet as `0x${string}`],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10_000)),
    ]);
    return Boolean(canSpin);
  } catch {
    // Graceful degradation — allow access if RPC fails
    return true;
  }
}

/**
 * Get the fee discount in basis points for a holder.
 * Returns 0-200 (0% to 2%).
 */
export async function getHeroFeeDiscount(wallet: string): Promise<number> {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return 0;
  if (HERO_CARDS_ADDRESS === "0x5Fad096af059ff9A2167351A0ffc8b45D71897bE") return 0;
  
  try {
    const discount = await Promise.race([
      baseClient.readContract({
        address: HERO_CARDS_ADDRESS,
        abi: HERO_CARDS_ABI,
        functionName: "getFeeDiscount",
        args: [wallet as `0x${string}`],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10_000)),
    ]);
    return Number(discount);
  } catch {
    return 0;
  }
}
