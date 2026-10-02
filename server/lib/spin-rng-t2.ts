/**
 * Tier 2 spin randomness: daily commit-reveal + a block hash mined AFTER the spin request. Fail-closed.
 *
 * Why this exists: the live spin path (rng-engine generateRandom, T1_OFFCHAIN) derives outcomes from public
 * inputs plus the server clock, so an operator can pick outcomes without detection. Here:
 *   1. Each UTC day has a secret seed. keccak256(seed) is published on-chain BEFORE that day's spins.
 *   2. A spin's value = HMAC-SHA256(seed, spin fields + hash of a block mined after the spin request).
 *      The operator cannot change the seed (it is committed), and nobody - operator included - knows the
 *      future block hash when the spin is requested, so a seed-holding insider cannot grind wallets.
 *   3. After the day ends the seed is revealed; anyone recomputes every spin with verifySpin().
 *
 * Pure module: no network, no wallet, no clock except where passed in. Every failure throws SpinRngError;
 * there is no fallback value. No committed seed for the day = no draw (spins with value are paused).
 */
import { createHmac, randomBytes } from "node:crypto";
import { ethers } from "ethers";

export class SpinRngError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpinRngError";
  }
}

export const DOMAIN = "vets-spin-t2|v1";
export const MIN_BLOCKS_AFTER_REQUEST = 1;
const MAX_DRAWS = 64;
const MAX_WEIGHT = 1_000_000_000;
const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;
const ADDR_RX = /^0x[0-9a-fA-F]{40}$/;
const HASH_RX = /^0x[0-9a-fA-F]{64}$/;
const TIERS = new Set(["bronze", "silver", "gold"]);
const SPAN = 1n << 256n;

export interface EpochRecord {
  day: string; // UTC YYYY-MM-DD
  seed: string; // 0x + 64 hex. SECRET until revealed.
  commitment: string; // keccak256(seed)
  commitTxHash?: string; // set when the commit transaction is mined
  commitBlockNumber?: number;
}

export interface SeedStore {
  get(day: string): Promise<EpochRecord | null>;
  /** Must durably persist before resolving and must refuse to overwrite an existing day. */
  insert(record: EpochRecord): Promise<void>;
  setCommit(day: string, commitTxHash: string, commitBlockNumber: number): Promise<void>;
}

export interface SpinInput {
  chainId: bigint;
  wallet: string;
  day: string;
  tier: string;
  nonce: number;
  requestBlockNumber: number; // chain head when the spin was requested
  drawBlockNumber: number; // later block whose hash seeds the draw
  drawBlockHash: string;
  totalWeight: number;
}

export interface SpinProof {
  domain: string;
  day: string;
  commitment: string;
  commitTxHash: string;
  commitBlockNumber: number;
  requestBlockNumber: number;
  drawBlockNumber: number;
  drawBlockHash: string;
}

function assertDay(day: string): void {
  if (!DAY_RX.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
    throw new SpinRngError(`day must be a real UTC date YYYY-MM-DD, got ${JSON.stringify(day)}`);
  }
}

function assertSeed(seed: string): void {
  if (!HASH_RX.test(seed)) throw new SpinRngError("seed must be 0x + 64 hex");
}

function assertBlock(n: number, name: string): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new SpinRngError(`${name} must be a non-negative integer`);
}

function assertInput(i: SpinInput): void {
  if (typeof i.chainId !== "bigint" || i.chainId <= 0n) throw new SpinRngError("chainId must be a positive bigint");
  if (!ADDR_RX.test(i.wallet)) throw new SpinRngError("wallet must be a 0x address");
  assertDay(i.day);
  if (!TIERS.has(i.tier)) throw new SpinRngError(`tier must be bronze, silver or gold, got ${JSON.stringify(i.tier)}`);
  if (!Number.isSafeInteger(i.nonce) || i.nonce < 0) throw new SpinRngError("nonce must be a non-negative integer");
  assertBlock(i.requestBlockNumber, "requestBlockNumber");
  assertBlock(i.drawBlockNumber, "drawBlockNumber");
  if (!HASH_RX.test(i.drawBlockHash)) throw new SpinRngError("drawBlockHash must be 0x + 64 hex");
  if (!Number.isSafeInteger(i.totalWeight) || i.totalWeight < 1 || i.totalWeight > MAX_WEIGHT) {
    throw new SpinRngError(`totalWeight must be an integer in [1, ${MAX_WEIGHT}]`);
  }
}

export function commitmentOf(seed: string): string {
  assertSeed(seed);
  return ethers.keccak256(seed);
}

/** Creates (or returns) the day's seed record. The seed is persisted and read back before anything is published. */
export async function prepareEpoch(store: SeedStore, day: string): Promise<EpochRecord> {
  assertDay(day);
  const existing = await store.get(day);
  if (existing) {
    if (existing.day !== day || commitmentOf(existing.seed) !== existing.commitment) {
      throw new SpinRngError(`stored epoch ${day} is corrupt (commitment does not match seed)`);
    }
    return existing;
  }
  const seed = ethers.hexlify(randomBytes(32));
  const record: EpochRecord = { day, seed, commitment: commitmentOf(seed) };
  await store.insert(record);
  const back = await store.get(day);
  if (!back || back.seed !== seed) throw new SpinRngError(`seed for ${day} did not persist; do not publish`);
  return record;
}

/** Calldata for a zero-value commit transaction (operator to itself). Timestamped and immutable on-chain. */
export function commitTxData(record: Pick<EpochRecord, "day" | "commitment">): string {
  assertDay(record.day);
  if (!HASH_RX.test(record.commitment)) throw new SpinRngError("commitment must be 0x + 64 hex");
  return ethers.hexlify(ethers.toUtf8Bytes(`${DOMAIN}|commit|${record.day}|${record.commitment.toLowerCase()}`));
}

export function parseCommitTxData(data: string): { day: string; commitment: string } {
  let text: string;
  try {
    text = ethers.toUtf8String(data);
  } catch {
    throw new SpinRngError("commit calldata is not UTF-8");
  }
  const m = /^vets-spin-t2\|v1\|commit\|(\d{4}-\d{2}-\d{2})\|(0x[0-9a-f]{64})$/.exec(text);
  if (!m) throw new SpinRngError("not a vets-spin-t2 v1 commit");
  assertDay(m[1]);
  return { day: m[1], commitment: m[2] };
}

/** The seed may be revealed only after its UTC day has ended. */
export function revealAllowed(day: string, now: Date): boolean {
  assertDay(day);
  return now.getTime() >= new Date(`${day}T00:00:00Z`).getTime() + 86_400_000;
}

/** Deterministic draw in [0, totalWeight), bias-free by rejection sampling. Exposed for public verification. */
export function deriveSpinValue(seed: string, input: SpinInput): number {
  assertSeed(seed);
  assertInput(input);
  const bound = BigInt(input.totalWeight);
  const limit = SPAN - (SPAN % bound);
  const key = Buffer.from(seed.slice(2), "hex");
  const base = [
    DOMAIN, input.chainId.toString(), input.wallet.toLowerCase(), input.day, input.tier, String(input.nonce),
    String(input.drawBlockNumber), input.drawBlockHash.toLowerCase(),
  ].join("|");
  for (let counter = 0; counter < MAX_DRAWS; counter++) {
    const word = BigInt("0x" + createHmac("sha256", key).update(`${base}|${counter}`).digest("hex"));
    if (word < limit) return Number(word % bound);
  }
  throw new SpinRngError("no unbiased word in 64 draws"); // probability < 2^-1900 for totalWeight <= 1e9
}

/** Fail-closed gate plus draw. Throws unless the day's commitment was mined before the spin was requested. */
export function spinValue(record: EpochRecord | null, input: SpinInput): { value: number; proof: SpinProof } {
  assertInput(input);
  if (!record) throw new SpinRngError(`no seed for ${input.day}: value spins are paused (fail-closed)`);
  if (record.day !== input.day) throw new SpinRngError("epoch day does not match spin day");
  if (!record.commitTxHash || !HASH_RX.test(record.commitTxHash) || record.commitBlockNumber === undefined) {
    throw new SpinRngError(`commitment for ${input.day} is not on-chain yet: value spins are paused (fail-closed)`);
  }
  assertBlock(record.commitBlockNumber, "commitBlockNumber");
  if (input.requestBlockNumber <= record.commitBlockNumber) {
    throw new SpinRngError("spin requested before the commitment was mined");
  }
  if (input.drawBlockNumber < input.requestBlockNumber + MIN_BLOCKS_AFTER_REQUEST) {
    throw new SpinRngError("draw block must be mined after the spin request");
  }
  if (commitmentOf(record.seed) !== record.commitment) throw new SpinRngError("stored seed does not match commitment");
  return {
    value: deriveSpinValue(record.seed, input),
    proof: {
      domain: DOMAIN,
      day: record.day,
      commitment: record.commitment,
      commitTxHash: record.commitTxHash,
      commitBlockNumber: record.commitBlockNumber,
      requestBlockNumber: input.requestBlockNumber,
      drawBlockNumber: input.drawBlockNumber,
      drawBlockHash: input.drawBlockHash,
    },
  };
}

/** Public check after reveal: the seed matches the on-chain commitment and reproduces the value. */
export function verifySpin(revealedSeed: string, commitment: string, input: SpinInput, value: number): boolean {
  try {
    return commitmentOf(revealedSeed) === commitment.toLowerCase() && deriveSpinValue(revealedSeed, input) === value;
  } catch {
    return false;
  }
}
