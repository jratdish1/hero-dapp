export type HeroSwapChain = "base" | "pulsechain";

export type HeroSwapIntent = {
  raw: string;
  chain: HeroSwapChain;
  fromToken: "ETH" | "PLS";
  toToken: "HERO";
  amountIn: string;
  createdAtMs: number;
  expiresAtMs: number;
};

export type IntentHandoffStatus =
  | "needs-confirm"
  | "ready"
  | "expired"
  | "chain-changed";

export const HERO_SWAP_INTENT_TTL_MS = 2 * 60 * 1000;

const AMOUNT_PATTERN = "(\\d+(?:\\.\\d+)?)";

function parseAmount(raw: string, token: "ETH" | "PLS"): string | null {
  const normalized = raw.trim().replace(/,/g, "");
  const patterns = [
    new RegExp(`(?:swap|sell)\\s+${AMOUNT_PATTERN}\\s+${token}\\s+(?:for|to)\\s+hero`, "i"),
    new RegExp(`(?:buy|get)\\s+hero\\s+(?:with|using)\\s+${AMOUNT_PATTERN}\\s+${token}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return match[1];
  }
  return null;
}

export function parseHeroSwapIntent(
  raw: string,
  activeChain: HeroSwapChain,
  nowMs = Date.now(),
): HeroSwapIntent | { error: string } {
  const normalized = raw.trim();
  if (!normalized) return { error: "Enter a swap intent first." };

  const explicitlyBase = /\bbase\b/i.test(normalized);
  const explicitlyPulse = /\b(?:pulsechain|pulse)\b/i.test(normalized);
  if (explicitlyBase && explicitlyPulse) {
    return { error: "Choose one chain only: BASE or PulseChain." };
  }

  const chain: HeroSwapChain = explicitlyBase
    ? "base"
    : explicitlyPulse
      ? "pulsechain"
      : activeChain;
  const fromToken = chain === "base" ? "ETH" : "PLS";

  if (!/\bhero\b/i.test(normalized)) {
    return { error: "This bounded intent flow only supports buying HERO." };
  }

  const amountIn = parseAmount(normalized, fromToken);
  if (!amountIn) {
    return {
      error: `Use a bounded intent such as “swap 0.01 ${fromToken} to HERO${chain === "base" ? " on BASE" : " on PulseChain"}”.`,
    };
  }

  return {
    raw: normalized,
    chain,
    fromToken,
    toToken: "HERO",
    amountIn,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + HERO_SWAP_INTENT_TTL_MS,
  };
}

export function getIntentHandoffStatus(
  intent: HeroSwapIntent,
  currentChain: HeroSwapChain,
  confirmed: boolean,
  nowMs = Date.now(),
): IntentHandoffStatus {
  if (currentChain !== intent.chain) return "chain-changed";
  if (nowMs >= intent.expiresAtMs) return "expired";
  return confirmed ? "ready" : "needs-confirm";
}

export function describeHeroSwapIntent(intent: HeroSwapIntent): string {
  return `${intent.amountIn} ${intent.fromToken} → HERO on ${intent.chain === "base" ? "BASE" : "PulseChain"}`;
}
