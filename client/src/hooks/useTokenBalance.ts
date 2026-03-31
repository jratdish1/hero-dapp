import { useAccount, useBalance, useReadContract } from "wagmi";
import { erc20Abi, type Address } from "viem";

/**
 * Read a token balance for the connected wallet.
 * For native tokens (address 0x000…000), uses eth_getBalance.
 * For ERC-20 tokens, uses balanceOf via useReadContract.
 */
export function useTokenBalance(
  tokenAddress: string,
  chainId: number,
  isNative?: boolean
) {
  const { address: walletAddress, isConnected } = useAccount();

  // Native balance (PLS on PulseChain, ETH on Base)
  const nativeResult = useBalance({
    address: walletAddress,
    chainId: chainId as 369 | 8453,
    query: {
      enabled: isConnected && !!walletAddress && !!isNative,
    },
  });

  // ERC-20 balance
  const erc20Result = useReadContract({
    address: tokenAddress as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: walletAddress ? [walletAddress] : undefined,
    chainId: chainId as 369 | 8453,
    query: {
      enabled:
        isConnected &&
        !!walletAddress &&
        !isNative &&
        tokenAddress !== "0x0000000000000000000000000000000000000000",
    },
  });

  if (isNative || tokenAddress === "0x0000000000000000000000000000000000000000") {
    return {
      balance: nativeResult.data?.value,
      decimals: nativeResult.data?.decimals ?? 18,
      symbol: nativeResult.data?.symbol ?? "",
      isLoading: nativeResult.isLoading,
      isError: nativeResult.isError,
      refetch: nativeResult.refetch,
    };
  }

  return {
    balance: erc20Result.data as bigint | undefined,
    decimals: 18, // default; caller can override
    symbol: "",
    isLoading: erc20Result.isLoading,
    isError: erc20Result.isError,
    refetch: erc20Result.refetch,
  };
}

/**
 * Format a bigint balance to a human-readable string.
 */
export function formatTokenBalance(
  balance: bigint | undefined,
  decimals: number = 18,
  maxDecimals: number = 4
): string {
  if (balance === undefined || balance === BigInt(0)) return "0.00";
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = balance / divisor;
  const fraction = balance % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, maxDecimals);
  const result = `${whole}.${fractionStr}`;
  // trim trailing zeros but keep at least 2 decimal places
  return parseFloat(result).toFixed(Math.min(maxDecimals, 2));
}
