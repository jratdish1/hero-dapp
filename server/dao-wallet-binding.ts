import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const CHALLENGE_VERSION = 1;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

interface WalletBindingPayload {
  version: number;
  userId: number;
  walletAddress: string;
  expiresAt: number;
  nonce: string;
}

function challengeSecret(): string {
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("Wallet binding challenge secret is unavailable");
  }
  return secret;
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", challengeSecret()).update(encodedPayload).digest("base64url");
}

export function issueWalletBindingChallenge(
  userId: number,
  walletAddress: string,
  now = Date.now(),
): string {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("Invalid wallet binding user");
  const normalizedAddress = walletAddress.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalizedAddress)) throw new Error("Invalid wallet binding address");
  const payload: WalletBindingPayload = {
    version: CHALLENGE_VERSION,
    userId,
    walletAddress: normalizedAddress,
    expiresAt: now + CHALLENGE_TTL_MS,
    nonce: randomBytes(24).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyWalletBindingChallenge(
  challenge: string,
  userId: number,
  walletAddress: string,
  now = Date.now(),
): void {
  const [encodedPayload, suppliedSignature, extra] = challenge.split(".");
  if (!encodedPayload || !suppliedSignature || extra !== undefined) {
    throw new Error("Wallet binding challenge is malformed");
  }
  const expectedSignature = signPayload(encodedPayload);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Wallet binding challenge signature is invalid");
  }

  let payload: WalletBindingPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as WalletBindingPayload;
  } catch {
    throw new Error("Wallet binding challenge payload is invalid");
  }
  const normalizedAddress = walletAddress.toLowerCase();
  if (
    payload.version !== CHALLENGE_VERSION
    || payload.userId !== userId
    || payload.walletAddress !== normalizedAddress
    || !Number.isSafeInteger(payload.expiresAt)
    || typeof payload.nonce !== "string"
    || payload.nonce.length < 16
  ) {
    throw new Error("Wallet binding challenge does not match this account and address");
  }
  if (payload.expiresAt <= now || payload.expiresAt > now + CHALLENGE_TTL_MS) {
    throw new Error("Wallet binding challenge has expired or has an invalid lifetime");
  }
}
