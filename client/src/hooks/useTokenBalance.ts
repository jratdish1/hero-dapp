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

  const erc20Enabled =
    isConnected &&
    !!walletAddress &&
    !isNative &&
    tokenAddress !== "0x0000000000000000000000000000000000000000";

  // ERC-20 balance
  const erc20Result = useReadContract({
    address: tokenAddress as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: walletAddress ? [walletAddress] : undefined,
    chainId: chainId as 369 | 8453,
    query: { enabled: erc20Enabled },
  });

  // Real token metadata. Tokens are not all 18 decimals (e.g. USDC = 6).
  const decimalsResult = useReadContract({
    address: tokenAddress as Address,
    abi: erc20Abi,
    functionName: "decimals",
    chainId: chainId as 369 | 8453,
    query: { enabled: erc20Enabled, staleTime: Infinity },
  });
  const symbolResult = useReadContract({
    address: tokenAddress as Address,
    abi: erc20Abi,
    functionName: "symbol",
    chainId: chainId as 369 | 8453,
    query: { enabled: erc20Enabled, staleTime: Infinity },
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

  const decimals = resolveTokenDecimals(decimalsResult.data);
  return {
    // Never format a balance with a guessed decimals value: hide it until decimals() is known.
    balance: decimals === undefined ? undefined : (erc20Result.data as bigint | undefined),
    decimals: decimals ?? 18,
    decimalsKnown: decimals !== undefined,
    symbol: (symbolResult.data as string | undefined) ?? "",
    isLoading: erc20Result.isLoading || decimalsResult.isLoading,
    isError: erc20Result.isError || decimalsResult.isError,
    refetch: erc20Result.refetch,
  };
}

/** Accept only a sane ERC-20 decimals() result (0..36); anything else is "unknown". */
export function resolveTokenDecimals(raw: unknown): number | undefined {
  const n = typeof raw === "bigint" ? Number(raw) : raw;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 36 ? n : undefined;
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
