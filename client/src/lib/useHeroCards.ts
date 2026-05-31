/**
 * useHeroCards — React hook for HeroCards NFT contract interactions
 * 
 * Provides:
 * - Mint (public + whitelist)
 * - Holder verification (isHolder, tier, fee discount, spin access)
 * - Collection stats (totalMinted, mintPhase, price)
 * - User stats (balance, minted count)
 */
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { 
  HERO_CARDS_ABI, 
  HERO_CARDS_ADDRESS, 
  HERO_CARDS_CHAIN_ID,
  HERO_CARDS_MINT_PRICE,
  HERO_CARDS_WL_PRICE,
  HERO_CARDS_MAX_PER_WALLET,
  HERO_CARDS_MAX_SUPPLY,
} from './heroCards-abi';

// ─── Types ───────────────────────────────────────────────────────
export enum MintPhase {
  CLOSED = 0,
  WHITELIST = 1,
  PUBLIC = 2,
}

export enum HolderTier {
  NONE = 0,
  BRONZE = 1,
  SILVER = 2,
  GOLD = 3,
}

export const TIER_NAMES: Record<HolderTier, string> = {
  [HolderTier.NONE]: 'None',
  [HolderTier.BRONZE]: 'Bronze',
  [HolderTier.SILVER]: 'Silver',
  [HolderTier.GOLD]: 'Gold',
};

export const TIER_COLORS: Record<HolderTier, string> = {
  [HolderTier.NONE]: 'text-gray-500',
  [HolderTier.BRONZE]: 'text-amber-600',
  [HolderTier.SILVER]: 'text-slate-300',
  [HolderTier.GOLD]: 'text-yellow-400',
};

// ─── Hook ────────────────────────────────────────────────────────
export function useHeroCards() {
  const { address, isConnected } = useAccount();

  // ─── Collection Stats ──────────────────────────────────────────
  const { data: totalMinted, refetch: refetchMinted } = useReadContract({
    address: HERO_CARDS_ADDRESS,
    abi: HERO_CARDS_ABI,
    functionName: 'totalMinted',
    chainId: HERO_CARDS_CHAIN_ID,
  });

  const { data: mintPhaseRaw } = useReadContract({
    address: HERO_CARDS_ADDRESS,
    abi: HERO_CARDS_ABI,
    functionName: 'mintPhase',
    chainId: HERO_CARDS_CHAIN_ID,
  });

  const { data: mintPriceRaw } = useReadContract({
    address: HERO_CARDS_ADDRESS,
    abi: HERO_CARDS_ABI,
    functionName: 'mintPrice',
    chainId: HERO_CARDS_CHAIN_ID,
  });

  // ─── User Stats ───────────────────────────────────────────────
  const { data: userBalance } = useReadContract({
    address: HERO_CARDS_ADDRESS,
    abi: HERO_CARDS_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: HERO_CARDS_CHAIN_ID,
    query: { enabled: !!address },
  });

  const { data: userMinted } = useReadContract({
    address: HERO_CARDS_ADDRESS,
    abi: HERO_CARDS_ABI,
    functionName: 'mintedPerWallet',
    args: address ? [address] : undefined,
    chainId: HERO_CARDS_CHAIN_ID,
    query: { enabled: !!address },
  });

  // ─── Holder Utility ───────────────────────────────────────────
  const { data: isHolder } = useReadContract({
    address: HERO_CARDS_ADDRESS,
    abi: HERO_CARDS_ABI,
    functionName: 'isHolder',
    args: address ? [address] : undefined,
    chainId: HERO_CARDS_CHAIN_ID,
    query: { enabled: !!address },
  });

  const { data: holderTierRaw } = useReadContract({
    address: HERO_CARDS_ADDRESS,
    abi: HERO_CARDS_ABI,
    functionName: 'getHolderTier',
    args: address ? [address] : undefined,
    chainId: HERO_CARDS_CHAIN_ID,
    query: { enabled: !!address },
  });

  const { data: feeDiscountRaw } = useReadContract({
    address: HERO_CARDS_ADDRESS,
    abi: HERO_CARDS_ABI,
    functionName: 'getFeeDiscount',
    args: address ? [address] : undefined,
    chainId: HERO_CARDS_CHAIN_ID,
    query: { enabled: !!address },
  });

  const { data: canSpin } = useReadContract({
    address: HERO_CARDS_ADDRESS,
    abi: HERO_CARDS_ABI,
    functionName: 'canAccessSpinWheel',
    args: address ? [address] : undefined,
    chainId: HERO_CARDS_CHAIN_ID,
    query: { enabled: !!address },
  });

  // ─── Mint Function ────────────────────────────────────────────
  const { writeContract, data: mintTxHash, isPending: isMinting, error: mintError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: mintSuccess } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  function mint(quantity: number) {
    if (!address) return;
    const phase = Number(mintPhaseRaw ?? 0) as MintPhase;
    if (phase === MintPhase.CLOSED) {
      throw new Error('Minting is currently closed');
    }
    const price = phase === MintPhase.WHITELIST 
      ? parseEther(HERO_CARDS_WL_PRICE) 
      : parseEther(HERO_CARDS_MINT_PRICE);
    const totalValue = price * BigInt(quantity);

    writeContract({
      address: HERO_CARDS_ADDRESS,
      abi: HERO_CARDS_ABI,
      functionName: 'mint',
      args: [BigInt(quantity)],
      value: totalValue,
      chainId: HERO_CARDS_CHAIN_ID,
    });
  }

  function whitelistMint(quantity: number, proof: `0x${string}`[]) {
    if (!address) return;
    const totalValue = parseEther(HERO_CARDS_WL_PRICE) * BigInt(quantity);

    writeContract({
      address: HERO_CARDS_ADDRESS,
      abi: HERO_CARDS_ABI,
      functionName: 'whitelistMint',
      args: [BigInt(quantity), proof],
      value: totalValue,
      chainId: HERO_CARDS_CHAIN_ID,
    });
  }

  // ─── Computed Values ──────────────────────────────────────────
  const mintPhase = Number(mintPhaseRaw ?? 0) as MintPhase;
  const holderTier = Number(holderTierRaw ?? 0) as HolderTier;
  const feeDiscount = Number(feeDiscountRaw ?? 0) / 100; // Convert bps to %
  const remaining = HERO_CARDS_MAX_SUPPLY - Number(totalMinted ?? 0);
  const canMint = mintPhase !== MintPhase.CLOSED && 
                  Number(userMinted ?? 0) < HERO_CARDS_MAX_PER_WALLET &&
                  remaining > 0;
  const maxMintable = Math.min(
    HERO_CARDS_MAX_PER_WALLET - Number(userMinted ?? 0),
    remaining
  );

  return {
    // Collection
    totalMinted: Number(totalMinted ?? 0),
    maxSupply: HERO_CARDS_MAX_SUPPLY,
    remaining,
    mintPhase,
    mintPrice: HERO_CARDS_MINT_PRICE,
    whitelistPrice: HERO_CARDS_WL_PRICE,

    // User
    isConnected,
    address,
    userBalance: Number(userBalance ?? 0),
    userMinted: Number(userMinted ?? 0),
    maxMintable,
    canMint,

    // Holder Utility
    isHolder: Boolean(isHolder),
    holderTier,
    tierName: TIER_NAMES[holderTier],
    tierColor: TIER_COLORS[holderTier],
    feeDiscount,
    canSpin: Boolean(canSpin),

    // Mint Actions
    mint,
    whitelistMint,
    isMinting,
    isConfirming,
    mintSuccess,
    mintError,
    mintTxHash,
    refetchMinted,
  };
}
