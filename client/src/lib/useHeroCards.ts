/**
 * useHeroCards — React hook for HeroCards NFT contract interactions
 *
 * Dual-chain aware: detects connected chain via wagmi and uses the correct
 * contract address, native symbol, and explorer link for Base or PulseChain.
 *
 * Supported chains:
 *   - Base (8453)      — native currency: ETH
 *   - PulseChain (369) — native currency: PLS
 *
 * Unsupported chains: canMint = false, chainSupported = false.
 */
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId } from 'wagmi';
import { parseEther } from 'viem';
import { HERO_CARDS_ABI } from './heroCards-abi';
import {
  getHeroCardsConfig,
  isSupportedHeroCardsChain,
  getHeroCardsExplorerTxUrl,
  HERO_CARDS_MAX_SUPPLY,
  HERO_CARDS_MAX_PER_WALLET,
  HERO_CARDS_MINT_PRICE_ETH,
  HERO_CARDS_WHITELIST_PRICE_ETH,
  type HeroCardsChainConfig,
} from './heroCards-config';

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useHeroCards() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Resolve chain config — undefined if unsupported
  const chainConfig: HeroCardsChainConfig | undefined = isSupportedHeroCardsChain(chainId)
    ? getHeroCardsConfig(chainId)
    : undefined;

  const chainSupported = !!chainConfig;
  const contractAddress = chainConfig?.contractAddress;
  const nativeSymbol = chainConfig?.nativeSymbol ?? 'ETH';
  const chainName = chainConfig?.name ?? 'Unsupported Network';

  // ─── Collection Stats ─────────────────────────────────────────────────────
  const { data: totalMinted, refetch: refetchMinted } = useReadContract({
    address: contractAddress,
    abi: HERO_CARDS_ABI,
    functionName: 'totalMinted',
    chainId: chainId,
    query: { enabled: chainSupported },
  });

  const { data: mintPhaseRaw } = useReadContract({
    address: contractAddress,
    abi: HERO_CARDS_ABI,
    functionName: 'mintPhase',
    chainId: chainId,
    query: { enabled: chainSupported },
  });

  const { data: mintPriceRaw } = useReadContract({
    address: contractAddress,
    abi: HERO_CARDS_ABI,
    functionName: 'mintPrice',
    chainId: chainId,
    query: { enabled: chainSupported },
  });

  // ─── User Stats ───────────────────────────────────────────────────────────
  const { data: userBalance } = useReadContract({
    address: contractAddress,
    abi: HERO_CARDS_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: chainId,
    query: { enabled: chainSupported && !!address },
  });

  const { data: userMinted } = useReadContract({
    address: contractAddress,
    abi: HERO_CARDS_ABI,
    functionName: 'mintedPerWallet',
    args: address ? [address] : undefined,
    chainId: chainId,
    query: { enabled: chainSupported && !!address },
  });

  // ─── Holder Utility ───────────────────────────────────────────────────────
  const { data: isHolder } = useReadContract({
    address: contractAddress,
    abi: HERO_CARDS_ABI,
    functionName: 'isHolder',
    args: address ? [address] : undefined,
    chainId: chainId,
    query: { enabled: chainSupported && !!address },
  });

  const { data: holderTierRaw } = useReadContract({
    address: contractAddress,
    abi: HERO_CARDS_ABI,
    functionName: 'getHolderTier',
    args: address ? [address] : undefined,
    chainId: chainId,
    query: { enabled: chainSupported && !!address },
  });

  const { data: feeDiscountRaw } = useReadContract({
    address: contractAddress,
    abi: HERO_CARDS_ABI,
    functionName: 'getFeeDiscount',
    args: address ? [address] : undefined,
    chainId: chainId,
    query: { enabled: chainSupported && !!address },
  });

  const { data: canSpin } = useReadContract({
    address: contractAddress,
    abi: HERO_CARDS_ABI,
    functionName: 'canAccessSpinWheel',
    args: address ? [address] : undefined,
    chainId: chainId,
    query: { enabled: chainSupported && !!address },
  });

  // ─── Mint Functions ───────────────────────────────────────────────────────
  const { writeContract, data: mintTxHash, isPending: isMinting, error: mintError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: mintSuccess } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  function mint(quantity: number) {
    if (!address || !contractAddress || !chainSupported) return;
    const phase = Number(mintPhaseRaw ?? 0) as MintPhase;
    if (phase === MintPhase.CLOSED) {
      throw new Error('Minting is currently closed');
    }
    const price = phase === MintPhase.WHITELIST
      ? parseEther(HERO_CARDS_WHITELIST_PRICE_ETH)
      : parseEther(HERO_CARDS_MINT_PRICE_ETH);
    const totalValue = price * BigInt(quantity);

    writeContract({
      address: contractAddress,
      abi: HERO_CARDS_ABI,
      functionName: 'mint',
      args: [BigInt(quantity)],
      value: totalValue,
      chainId: chainId,
    });
  }

  function whitelistMint(quantity: number, proof: `0x${string}`[]) {
    if (!address || !contractAddress || !chainSupported) return;
    const totalValue = parseEther(HERO_CARDS_WHITELIST_PRICE_ETH) * BigInt(quantity);

    writeContract({
      address: contractAddress,
      abi: HERO_CARDS_ABI,
      functionName: 'whitelistMint',
      args: [BigInt(quantity), proof],
      value: totalValue,
      chainId: chainId,
    });
  }

  // ─── Explorer Link ────────────────────────────────────────────────────────
  const mintTxExplorerUrl = mintTxHash
    ? getHeroCardsExplorerTxUrl(chainId, mintTxHash)
    : undefined;

  // ─── Computed Values ──────────────────────────────────────────────────────
  const mintPhase = Number(mintPhaseRaw ?? 0) as MintPhase;
  const holderTier = Number(holderTierRaw ?? 0) as HolderTier;
  const feeDiscount = Number(feeDiscountRaw ?? 0) / 100; // bps → %
  const remaining = HERO_CARDS_MAX_SUPPLY - Number(totalMinted ?? 0);
  const canMint = chainSupported &&
    mintPhase !== MintPhase.CLOSED &&
    Number(userMinted ?? 0) < HERO_CARDS_MAX_PER_WALLET &&
    remaining > 0;
  const maxMintable = Math.min(
    HERO_CARDS_MAX_PER_WALLET - Number(userMinted ?? 0),
    remaining,
  );

  return {
    // Chain
    chainId,
    chainName,
    chainSupported,
    nativeSymbol,
    contractAddress,

    // Collection
    totalMinted: Number(totalMinted ?? 0),
    maxSupply: HERO_CARDS_MAX_SUPPLY,
    remaining,
    mintPhase,
    mintPrice: HERO_CARDS_MINT_PRICE_ETH,
    whitelistPrice: HERO_CARDS_WHITELIST_PRICE_ETH,

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
    mintTxExplorerUrl,
    refetchMinted,
  };
}
