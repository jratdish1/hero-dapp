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

// DCA Order limits
export const MAX_DCA_AMOUNT = 1_000_000_000; // 1 billion max per order
export const MAX_DCA_ORDERS = 100;
export const MIN_DCA_ORDERS = 1;

export function isValidDcaAmount(amount: string): { valid: boolean; error?: string } {
  if (!amount || amount.trim() === '') return { valid: false, error: "Amount is required" };
  const clean = amount.replace(/,/g, '');
  const num = parseFloat(clean);
  if (isNaN(num) || !isFinite(num)) return { valid: false, error: "Invalid number" };
  if (num <= 0) return { valid: false, error: "Amount must be positive" };
  if (num > MAX_DCA_AMOUNT) return { valid: false, error: "Amount exceeds maximum (1B)" };
  const parts = clean.split('.');
  if (parts.length > 1 && parts[1].length > 18) return { valid: false, error: "Max 18 decimal places" };
  return { valid: true };
}

export function isValidOrderCount(count: string): { valid: boolean; error?: string } {
  const num = parseInt(count);
  if (isNaN(num)) return { valid: false, error: "Invalid number" };
  if (num < MIN_DCA_ORDERS) return { valid: false, error: "Minimum 1 order" };
  if (num > MAX_DCA_ORDERS) return { valid: false, error: "Maximum 100 orders" };
  return { valid: true };
}
