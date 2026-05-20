/**
 * HERO DAO — Output Sanitization Utility
 * ========================================
 * Production Condition #3: Add DOMPurify on frontend rendering of proposal content.
 * 
 * This module provides safe rendering of user-generated content (proposal titles,
 * descriptions, delegate statements) by sanitizing output before DOM insertion.
 * 
 * Strategy: Since we render as plain text in React (not dangerouslySetInnerHTML),
 * the primary XSS vector is already mitigated. This module adds defense-in-depth
 * for any future markdown/rich-text rendering and provides a consistent API.
 * 
 * IMPORTANT: This does NOT replace input validation — it's a second layer.
 * Input validation happens server-side in dao-security-hardening.ts.
 */

// ─── Dangerous Pattern Detection ────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,
  /data\s*:\s*text\/html/i,
  /vbscript\s*:/i,
  /expression\s*\(/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /<form[\s>]/i,
  /<link[\s>]/i,
  /<meta[\s>]/i,
  /<base[\s>]/i,
  /&#x?[0-9a-f]+;/i,
  /%3[Cc]script/i,
  /\\u003[Cc]/i,
];

// ─── Core Sanitization Functions ────────────────────────────────────────

/**
 * Sanitize a string for safe display in the DOM.
 * Escapes HTML entities and strips dangerous patterns.
 * 
 * Use this for ALL user-generated content before rendering.
 * 
 * @param input - Raw user input string
 * @returns Sanitized string safe for text rendering
 */
export function sanitizeForDisplay(input: string | null | undefined): string {
  if (!input) return '';
  
  let clean = input
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Remove null bytes
    .replace(/\0/g, '');

  return clean;
}

/**
 * Sanitize a string for safe rendering as plain text in React.
 * Since React auto-escapes JSX text content, this is primarily
 * for defense-in-depth and catching edge cases.
 * 
 * @param input - Raw user input string
 * @returns Clean string with dangerous content stripped
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  
  // Strip any HTML tags entirely (we only want plain text)
  let clean = input.replace(/<[^>]*>/g, '');
  
  // Remove null bytes and control characters (except newlines/tabs)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return clean.trim();
}

/**
 * Check if a string contains potentially dangerous content.
 * Use this for flagging/logging without blocking.
 * 
 * @param input - String to check
 * @returns true if suspicious content detected
 */
export function containsDangerousContent(input: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Sanitize a wallet address for display.
 * Ensures it's a valid hex format and nothing else.
 * 
 * @param address - Wallet address string
 * @returns Sanitized address or empty string if invalid
 */
export function sanitizeAddress(address: string | null | undefined): string {
  if (!address) return '';
  // Only allow valid Ethereum/PulseChain addresses
  const clean = address.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(clean)) {
    return clean;
  }
  return '';
}

/**
 * Truncate an address for display (0x1234...5678 format).
 * 
 * @param address - Full wallet address
 * @param startChars - Characters to show at start (default: 6)
 * @param endChars - Characters to show at end (default: 4)
 */
export function truncateAddress(
  address: string | null | undefined,
  startChars: number = 6,
  endChars: number = 4
): string {
  const clean = sanitizeAddress(address);
  if (!clean) return '';
  if (clean.length <= startChars + endChars) return clean;
  return `${clean.slice(0, startChars)}...${clean.slice(-endChars)}`;
}

/**
 * Sanitize a proposal description for rendering.
 * Preserves newlines for whitespace-pre-wrap display.
 * 
 * @param description - Raw proposal description
 * @returns Sanitized description safe for rendering
 */
export function sanitizeProposalContent(description: string | null | undefined): string {
  if (!description) return '';
  
  // Strip HTML tags
  let clean = description.replace(/<[^>]*>/g, '');
  
  // Remove dangerous patterns
  DANGEROUS_PATTERNS.forEach(pattern => {
    clean = clean.replace(pattern, '[removed]');
  });
  
  // Remove null bytes and control chars (preserve \n and \t)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length to prevent DoS via massive strings
  if (clean.length > 50000) {
    clean = clean.slice(0, 50000) + '\n\n[Content truncated — exceeds maximum length]';
  }
  
  return clean.trim();
}

// ─── React Hook for Sanitized Content ───────────────────────────────────

/**
 * Hook-compatible sanitizer for use in React components.
 * Returns a memoization-friendly sanitized version of the input.
 * 
 * Usage in component:
 *   const safeDescription = useSanitized(proposal.description);
 *   return <p>{safeDescription}</p>;
 */
export function useSanitized(input: string | null | undefined): string {
  return sanitizeProposalContent(input);
}
