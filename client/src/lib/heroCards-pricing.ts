/**
 * heroCards-pricing — pure helpers that bind HeroCards mint payments to the
 * prices the contract reports on-chain.
 *
 * Why: the mint UI previously paid static config prices. If the owner changed
 * mintPrice/whitelistPrice on-chain, the wallet would send the wrong value
 * (failed tx, or overpayment if the contract does not refund).
 * Rule: no on-chain price read = no mint (fail closed).
 */
import { formatEther } from "viem";

export class HeroCardsPriceUnavailableError extends Error {
  constructor() {
    super("On-chain mint price is not available yet. Minting is disabled until it loads.");
    this.name = "HeroCardsPriceUnavailableError";
  }
}

/** Accept only a real non-negative bigint from the contract read. */
export function readPrice(raw: unknown): bigint | undefined {
  return typeof raw === "bigint" && raw >= BigInt(0) ? raw : undefined;
}

/**
 * Total wei to send for `quantity` tokens at the given on-chain unit price.
 * Throws HeroCardsPriceUnavailableError when the price is unknown.
 */
export function mintValueWei(unitPriceWei: bigint | undefined, quantity: number): bigint {
  if (unitPriceWei === undefined) throw new HeroCardsPriceUnavailableError();
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError("Mint quantity must be a positive integer.");
  }
  return unitPriceWei * BigInt(quantity);
}

/** Display string for a price: on-chain value in native units, or an em dash while unknown. */
export function formatPrice(unitPriceWei: bigint | undefined): string {
  return unitPriceWei === undefined ? "\u2014" : formatEther(unitPriceWei);
}
