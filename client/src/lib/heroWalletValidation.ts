import { isAddress } from "viem";

export interface WalletBalanceLike {
  symbol: string;
  chain: string;
  balance: string;
}

export const SUPPORTED_BRIDGE_CHAINS = [
  "base",
  "pulsechain",
  "ethereum",
  "arbitrum",
] as const;

export function sanitizeWalletTokenSymbol(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function validateSendRequest({
  sendTo,
  sendAmount,
  sendToken,
  sendChain,
  balances,
}: {
  sendTo: string;
  sendAmount: string;
  sendToken: string;
  sendChain: string;
  balances: WalletBalanceLike[];
}): { sanitizedToken: string; tokenBalance: WalletBalanceLike } | { error: string } {
  if (!sendTo || !isAddress(sendTo)) {
    return { error: "Invalid recipient address" };
  }

  const amountNum = Number(sendAmount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { error: "Invalid amount" };
  }

  const sanitizedToken = sanitizeWalletTokenSymbol(sendToken);
  if (!sanitizedToken) {
    return { error: "Invalid token symbol" };
  }

  const hasToken = balances.some(
    (balance) => balance.symbol.toUpperCase() === sanitizedToken
  );
  if (!hasToken) {
    return { error: "Token not supported or unknown" };
  }

  const tokenBalance = balances.find(
    (balance) =>
      balance.symbol.toUpperCase() === sanitizedToken &&
      balance.chain === sendChain
  );
  if (!tokenBalance) {
    return { error: "Token balance not found" };
  }

  if (amountNum > Number(tokenBalance.balance)) {
    return { error: "Amount exceeds balance" };
  }

  return { sanitizedToken, tokenBalance };
}

export function validateBridgeRequest({
  bridgeFrom,
  bridgeTo,
  bridgeAmount,
  bridgeToken,
}: {
  bridgeFrom: string;
  bridgeTo: string;
  bridgeAmount: string;
  bridgeToken: string;
}): { sanitizedToken: string } | { error: string } {
  if (!bridgeAmount || Number(bridgeAmount) <= 0) {
    return { error: "Enter valid bridge amount" };
  }

  const sanitizedToken = sanitizeWalletTokenSymbol(bridgeToken);
  if (!sanitizedToken) {
    return { error: "Invalid token symbol" };
  }

  if (!SUPPORTED_BRIDGE_CHAINS.includes(bridgeFrom as (typeof SUPPORTED_BRIDGE_CHAINS)[number])) {
    return { error: "Unsupported source chain" };
  }

  if (!SUPPORTED_BRIDGE_CHAINS.includes(bridgeTo as (typeof SUPPORTED_BRIDGE_CHAINS)[number])) {
    return { error: "Unsupported destination chain" };
  }

  if (bridgeFrom === bridgeTo) {
    return { error: "Select different source and destination chains" };
  }

  return { sanitizedToken };
}
