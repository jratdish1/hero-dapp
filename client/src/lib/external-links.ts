/**
 * HeroBase.io - External Links Configuration
 * Single source of truth for DEX links, explorer links, and external resources.
 */

import { getChainConfig, type SupportedChainId } from "./config";

// ─── Explorer Links ─────────────────────────────────────────────────────

export function getExplorerAddressUrl(chainId: SupportedChainId, address: string): string {
  const config = getChainConfig(chainId);
  if (!config) return "";
  return `${config.explorer}/address/${address}`;
}

export function getExplorerTxUrl(chainId: SupportedChainId, txHash: string): string {
  const config = getChainConfig(chainId);
  if (!config) return "";
  return `${config.explorer}/tx/${txHash}`;
}

export function getExplorerTokenUrl(chainId: SupportedChainId, tokenAddress: string): string {
  const config = getChainConfig(chainId);
  if (!config) return "";
  return `${config.explorer}/token/${tokenAddress}`;
}

// ─── DEX / Swap Links ───────────────────────────────────────────────────

export function getSwapUrl(chainId: SupportedChainId, tokenIn?: string, tokenOut?: string): string {
  const config = getChainConfig(chainId);
  if (!config) return "";
  
  // Base chain: Use Uniswap
  if (chainId === 8453) {
    let url = "https://app.uniswap.org/#/swap";
    if (tokenIn) url += `?inputCurrency=${tokenIn}`;
    if (tokenOut) url += tokenIn ? `&outputCurrency=${tokenOut}` : `?outputCurrency=${tokenOut}`;
    return url;
  }
  
  // PulseChain: Use typical DEX or fallback
  if (chainId === 369) {
    // PulseDEX or PancakeSwap fallback
    let url = "https://swap.pulsechain.com";
    if (tokenIn) url += `?inputCurrency=${tokenIn}`;
    if (tokenOut) url += tokenIn ? `&outputCurrency=${tokenOut}` : `?outputCurrency=${tokenOut}`;
    return url;
  }
  
  return "";
}

export function getLiquidityUrl(chainId: SupportedChainId, tokenAddress?: string): string {
  const config = getChainConfig(chainId);
  if (!config) return "";
  
  if (chainId === 8453) {
    let url = "https://app.uniswap.org/#/pool";
    if (tokenAddress) url += `?token0=${tokenAddress}`;
    return url;
  }
  
  if (chainId === 369) {
    let url = "https://swap.pulsechain.com/#/pool";
    if (tokenAddress) url += `?token0=${tokenAddress}`;
    return url;
  }
  
  return "";
}

// ─── Bridge Links ────────────────────────────────────────────────────────

export function getBridgeUrl(fromChainId?: SupportedChainId, toChainId?: SupportedChainId): string {
  // Common bridges
  if (fromChainId === 8453 || toChainId === 8453) {
    return "https://bridge.base.org";
  }
  if (fromChainId === 369 || toChainId === 369) {
    return "https://bridge.pulsechain.com";
  }
  // Default
  return "https://app.layerzero.network/bridge";
}

// ─── Social / Documentation Links ───────────────────────────────────────

export const EXTERNAL_LINKS = {
  documentation: "https://docs.herobase.io",
  discord: "https://discord.gg/herobase",
  twitter: "https://twitter.com/herobaseio",
  telegram: "https://t.me/herobase",
  github: "https://github.com/jratdish1/hero-dapp",
  website: "https://herobase.io",
} as const;

// ─── Wallet Connection Links ─────────────────────────────────────────────

export function getWalletConnectDeepLink(walletId: string): string {
  const links: Record<string, string> = {
    metamask: "https://metamask.app.link/wc",
    walletconnect: "https://walletconnect.com/",
    coinbase: "https://wallet.coinbase.com/wc",
  };
  return links[walletId] || "";
}