// validation.ts — Input validation utilities for DeFi operations
// Added per GPT-4.1 Codex Audit 2026-05-11

export const SUPPORTED_CHAIN_IDS = [369, 8453] as const;
export type SupportedChainId = typeof SUPPORTED_CHAIN_IDS[number];

export function isValidChainId(chainId: number | undefined): chainId is SupportedChainId {
  return chainId !== undefined && SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId);
}

export function isValidAmount(amount: string): boolean {
  if (!amount || amount.trim() === '') return false;
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && isFinite(num);
}

export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function validateDecimalInput(value: string, maxDecimals: number = 18): boolean {
  if (!value) return false;
  const regex = new RegExp(`^\\d+(\\.\\d{0,${maxDecimals}})?$`);
  return regex.test(value);
}

export function isBalanceSufficient(balance: bigint | undefined, amount: bigint): boolean {
  if (balance === undefined) return false;
  return balance >= amount;
}
