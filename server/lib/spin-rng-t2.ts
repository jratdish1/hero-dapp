/**
 * Tier 2 spin randomness: daily commit-reveal + a block hash mined AFTER the spin request. Fail-closed.
 *
 * Why this exists: the live spin path (rng-engine generateRandom, T1_OFFCHAIN) derives outcomes from public
 * inputs plus the server clock, so an operator can pick outcomes without detection. Here:
 *   1. Each UTC day has a secret seed. keccak256(seed) is published on-chain BEFORE that day's spins.
 *   2. A spin's value = HMAC-SHA256(seed, spin fields + hash of a block mined after the spin request).
 *      The operator cannot change the seed (it is committed), and nobody - operator included - knows the
 *      future block hash when the spin is requested, so a seed-holding insider cannot grind wallets.
 *   3. The wallet signs each spin intent (wallet, day, tier, sequential nonce). A transaction carrying that
 *      intent and signature, sent by the operator or the wallet, is mined in block N; N is read from the
 *      chain, never passed in. The draw block is N + DRAW_BLOCK_OFFSET, and recordSpinRequest refuses once
 *      that block exists. The operator learns the draw hash only after the request is immutably on-chain, so
 *      it cannot pick a favourable draw block, and a spin it drops after the draw stays visible on-chain
 *      (and in verifyDayLog as a missing result or nonce gap).
 *   4. spinValue() derives nothing until verifySpinOnChain() has checked the request tx, the signature, the
 *      commit tx and the canonical draw hash. Never pay a prize from deriveSpinValue() alone.
 *   5. After the day ends the seed is revealed; anyone recomputes every spin with verifySpin(), checks the
 *      day's log with verifyDayLog(), and checks chain facts with verifySpinOnChain().
 *
 * Residual trust: the block producer (Base sequencer, PulseChain validators) can still bias a block hash.
 * Acceptable only for low-value prizes.
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
/** The draw block is exactly this many blocks after the request block; never caller-chosen. */
export const DRAW_BLOCK_OFFSET = 2;
const MAX_DRAWS = 64;
const MAX_WEIGHT = 1_000_000_000;
const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;
const ADDR_RX = /^0x[0-9a-fA-F]{40}$/;
const HASH_RX = /^0x[0-9a-fA-F]{64}$/;
const SIG_RX = /^0x[0-9a-fA-F]{130}$/;
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

/** What the wallet signs (EIP-191 personal_sign of requestIntentLine). */
export interface SpinRequestIntent {
  chainId: bigint;
  wallet: string;
  day: string;
  tier: string;
  nonce: number; // 0, 1, 2, ... per (wallet, day), no gaps
}

export interface SpinRequest extends SpinRequestIntent {
  requestBlockNumber: number; // block in which the request tx was mined (read from the chain)
  requestTxHash: string;
  signature: string; // wallet's signature over requestIntentLine
}

type RequestFields = Pick<SpinRequest, "chainId" | "wallet" | "day" | "tier" | "nonce" | "requestBlockNumber">;

export interface SpinRequestStore {
  /** Number of requests already recorded for (wallet lower-cased, day); the next nonce must equal it. */
  count(wallet: string, day: string): Promise<number>;
  /** Must durably persist (append-only) before resolving and must refuse to overwrite an existing nonce. */
  append(request: SpinRequest): Promise<void>;
  get(wallet: string, day: string, nonce: number): Promise<SpinRequest | null>;
}

export interface SpinInput {
  chainId: bigint;
  wallet: string;
  day: string;
  tier: string;
  nonce: number;
  requestBlockNumber: number; // chain head when the spin was requested
  drawBlockNumber: number; // must equal requestBlockNumber + DRAW_BLOCK_OFFSET
  drawBlockHash: string;
  totalWeight: number;
}

export interface SpinProof {
  domain: string;
  day: string;
  commitment: string;
  commitTxHash: string;
  commitBlockNumber: number;
  requestTxHash: string;
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
  if (i.drawBlockNumber !== i.requestBlockNumber + DRAW_BLOCK_OFFSET) {
    throw new SpinRngError(`drawBlockNumber must be requestBlockNumber + ${DRAW_BLOCK_OFFSET}`);
  }
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

function assertIntent(r: SpinRequestIntent): void {
  if (typeof r.chainId !== "bigint" || r.chainId <= 0n) throw new SpinRngError("chainId must be a positive bigint");
  if (!ADDR_RX.test(r.wallet)) throw new SpinRngError("wallet must be a 0x address");
  assertDay(r.day);
  if (!TIERS.has(r.tier)) throw new SpinRngError(`tier must be bronze, silver or gold, got ${JSON.stringify(r.tier)}`);
  if (!Number.isSafeInteger(r.nonce) || r.nonce < 0) throw new SpinRngError("nonce must be a non-negative integer");
}

function assertRequest(r: SpinRequest): void {
  assertIntent(r);
  assertBlock(r.requestBlockNumber, "requestBlockNumber");
  if (!HASH_RX.test(r.requestTxHash)) throw new SpinRngError("requestTxHash must be 0x + 64 hex");
  if (!SIG_RX.test(r.signature)) throw new SpinRngError("signature must be 0x + 130 hex");
}

function sameIntent(a: SpinRequestIntent, b: SpinRequestIntent): boolean {
  return a.chainId === b.chainId && a.wallet.toLowerCase() === b.wallet.toLowerCase() && a.day === b.day
    && a.tier === b.tier && a.nonce === b.nonce;
}

function sameRequest(a: RequestFields, b: RequestFields): boolean {
  return sameIntent(a, b) && a.requestBlockNumber === b.requestBlockNumber;
}

/** The exact text the wallet signs (EIP-191) to request a spin. */
export function requestIntentLine(i: SpinRequestIntent): string {
  assertIntent(i);
  return [DOMAIN, "intent", i.chainId.toString(), i.wallet.toLowerCase(), i.day, i.tier, String(i.nonce)].join("|");
}

/** Calldata for the request transaction: the signed intent plus the wallet's signature. */
export function requestTxData(i: SpinRequestIntent, signature: string): string {
  if (!SIG_RX.test(signature)) throw new SpinRngError("signature must be 0x + 130 hex");
  return ethers.hexlify(ethers.toUtf8Bytes(`${requestIntentLine(i)}|${signature.toLowerCase()}`));
}

export function parseRequestTxData(data: string): { intent: SpinRequestIntent; signature: string } {
  let text: string;
  try {
    text = ethers.toUtf8String(data);
  } catch {
    throw new SpinRngError("request calldata is not UTF-8");
  }
  const m = /^vets-spin-t2\|v1\|intent\|(\d+)\|(0x[0-9a-f]{40})\|(\d{4}-\d{2}-\d{2})\|(bronze|silver|gold)\|(\d+)\|(0x[0-9a-f]{130})$/.exec(text);
  if (!m) throw new SpinRngError("not a vets-spin-t2 v1 request");
  const intent: SpinRequestIntent = { chainId: BigInt(m[1]), wallet: m[2], day: m[3], tier: m[4], nonce: Number(m[5]) };
  assertIntent(intent);
  return { intent, signature: m[6] };
}

/** Canonical one-line form of a recorded request, for the public append-only log. */
export function requestLogLine(r: SpinRequest): string {
  assertRequest(r);
  return [DOMAIN, "request", r.chainId.toString(), r.wallet.toLowerCase(), r.day, r.tier, String(r.nonce),
    String(r.requestBlockNumber), r.requestTxHash.toLowerCase()].join("|");
}

/**
 * Checks that requestTxHash is mined, was sent by the operator or the wallet, and carries this exact
 * intent with a valid wallet signature. Returns the block it was mined in and the signature.
 */
async function verifyRequestTx(
  intent: SpinRequestIntent,
  requestTxHash: string,
  operator: string,
  chain: ChainReader,
): Promise<{ blockNumber: number; signature: string }> {
  if (!ADDR_RX.test(operator)) throw new SpinRngError("operator must be a 0x address");
  const tx = await chain.getTransaction(requestTxHash);
  if (!tx || tx.blockNumber === null) throw new SpinRngError("request transaction is not mined");
  const from = tx.from.toLowerCase();
  if (from !== operator.toLowerCase() && from !== intent.wallet.toLowerCase()) {
    throw new SpinRngError("request transaction was not sent by the operator or the wallet");
  }
  const parsed = parseRequestTxData(tx.data);
  if (!sameIntent(parsed.intent, intent)) throw new SpinRngError("request transaction carries a different intent");
  let signer: string;
  try {
    signer = ethers.verifyMessage(requestIntentLine(intent), parsed.signature);
  } catch {
    throw new SpinRngError("request signature is malformed");
  }
  if (signer.toLowerCase() !== intent.wallet.toLowerCase()) throw new SpinRngError("request is not signed by the wallet");
  return { blockNumber: tx.blockNumber, signature: parsed.signature };
}

/**
 * Records a spin request whose signed intent is already mined on-chain, before its draw block exists.
 * The request block is the block the request tx was mined in (read from the chain), and the draw block
 * becomes that block + DRAW_BLOCK_OFFSET. Throws (records nothing) unless the request tx verifies, the
 * draw block does not exist yet, the day's commitment was mined earlier, the nonce is the next one for
 * this wallet and day, and the record reads back identically.
 */
export async function recordSpinRequest(
  store: SpinRequestStore,
  epoch: EpochRecord | null,
  intent: SpinRequestIntent,
  requestTxHash: string,
  operator: string,
  chain: ChainReader,
): Promise<{ request: SpinRequest; drawBlockNumber: number }> {
  const wallet = intent.wallet.toLowerCase();
  assertIntent({ ...intent, wallet });
  if (!HASH_RX.test(requestTxHash)) throw new SpinRngError("requestTxHash must be 0x + 64 hex");
  if (!epoch || epoch.day !== intent.day || epoch.commitBlockNumber === undefined || !epoch.commitTxHash) {
    throw new SpinRngError(`commitment for ${intent.day} is not on-chain yet: value spins are paused (fail-closed)`);
  }
  const { blockNumber: requestBlockNumber, signature } = await verifyRequestTx({ ...intent, wallet }, requestTxHash, operator, chain);
  if (requestBlockNumber <= epoch.commitBlockNumber) {
    throw new SpinRngError("spin requested before the commitment was mined");
  }
  const drawBlockNumber = requestBlockNumber + DRAW_BLOCK_OFFSET;
  if ((await chain.getBlockHash(requestBlockNumber)) === null) {
    throw new SpinRngError("request block is not known to the chain reader");
  }
  if ((await chain.getBlockHash(drawBlockNumber)) !== null) {
    throw new SpinRngError("draw block already exists: request recorded too late (fail-closed)");
  }
  const full: SpinRequest = { ...intent, wallet, requestBlockNumber, requestTxHash: requestTxHash.toLowerCase(), signature };
  assertRequest(full);
  const expected = await store.count(full.wallet, full.day);
  if (full.nonce !== expected) throw new SpinRngError(`nonce must be ${expected} (sequential per wallet and day)`);
  await store.append(full);
  const back = await store.get(full.wallet, full.day, full.nonce);
  if (!back || !sameRequest(back, full) || back.requestTxHash !== full.requestTxHash) {
    throw new SpinRngError("spin request did not persist; do not draw");
  }
  return { request: full, drawBlockNumber };
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

/**
 * Fail-closed gate plus draw. Throws unless the spin request was recorded (recordSpinRequest) with exactly
 * these fields, the day's commitment was mined before the request, and verifySpinOnChain() accepts the
 * request tx, signature, commit tx and canonical draw hash. Only then is a value derived.
 */
export async function spinValue(
  record: EpochRecord | null,
  recorded: SpinRequest | null,
  input: SpinInput,
  operator: string,
  chain: ChainReader,
): Promise<{ value: number; proof: SpinProof }> {
  assertInput(input);
  if (!recorded || !sameRequest(recorded, input)) {
    throw new SpinRngError("spin request was not recorded before the draw (fail-closed)");
  }
  if (!record) throw new SpinRngError(`no seed for ${input.day}: value spins are paused (fail-closed)`);
  if (record.day !== input.day) throw new SpinRngError("epoch day does not match spin day");
  if (!record.commitTxHash || !HASH_RX.test(record.commitTxHash) || record.commitBlockNumber === undefined) {
    throw new SpinRngError(`commitment for ${input.day} is not on-chain yet: value spins are paused (fail-closed)`);
  }
  assertBlock(record.commitBlockNumber, "commitBlockNumber");
  if (input.requestBlockNumber <= record.commitBlockNumber) {
    throw new SpinRngError("spin requested before the commitment was mined");
  }
  if (commitmentOf(record.seed) !== record.commitment) throw new SpinRngError("stored seed does not match commitment");
  const proof: SpinProof = {
    domain: DOMAIN,
    day: record.day,
    commitment: record.commitment,
    commitTxHash: record.commitTxHash,
    commitBlockNumber: record.commitBlockNumber,
    requestTxHash: recorded.requestTxHash,
    requestBlockNumber: input.requestBlockNumber,
    drawBlockNumber: input.drawBlockNumber,
    drawBlockHash: input.drawBlockHash,
  };
  if (!(await verifySpinOnChain(proof, input, operator, chain))) {
    throw new SpinRngError("chain facts do not verify (request tx, signature, commit tx or draw hash): no draw");
  }
  return { value: deriveSpinValue(record.seed, input), proof };
}

/**
 * Public check after reveal: the seed matches the commitment and reproduces the value, and the draw block
 * is the pinned offset from the request block (enforced by deriveSpinValue). Chain facts are checked
 * separately by verifySpinOnChain().
 */
export function verifySpin(revealedSeed: string, commitment: string, input: SpinInput, value: number): boolean {
  try {
    return commitmentOf(revealedSeed) === commitment.toLowerCase() && deriveSpinValue(revealedSeed, input) === value;
  } catch {
    return false;
  }
}

export interface ChainReader {
  /** Canonical block hash at height n, or null if unknown. */
  getBlockHash(n: number): Promise<string | null>;
  getTransaction(hash: string): Promise<{ from: string; to: string | null; blockNumber: number | null; data: string } | null>;
}

/**
 * Checks what the off-chain proof cannot prove by itself: the request tx is mined in the request block,
 * was sent by the operator or the wallet, and carries this intent signed by the wallet; the commit tx was
 * sent by the operator, carries this day's commitment, and was mined strictly before the request block;
 * and the draw block hash is the canonical hash at the pinned height. Returns false on any mismatch or
 * reader error.
 */
export async function verifySpinOnChain(
  proof: SpinProof,
  input: SpinInput,
  operator: string,
  chain: ChainReader,
): Promise<boolean> {
  try {
    assertInput(input);
    if (!ADDR_RX.test(operator)) return false;
    if (proof.day !== input.day || proof.requestBlockNumber !== input.requestBlockNumber
      || proof.drawBlockNumber !== input.drawBlockNumber
      || proof.drawBlockHash.toLowerCase() !== input.drawBlockHash.toLowerCase()) return false;
    const { blockNumber: requestBlock } = await verifyRequestTx(input, proof.requestTxHash, operator, chain);
    if (requestBlock !== input.requestBlockNumber) return false;
    const tx = await chain.getTransaction(proof.commitTxHash);
    if (!tx || tx.blockNumber === null || tx.blockNumber !== proof.commitBlockNumber) return false;
    if (tx.from.toLowerCase() !== operator.toLowerCase()) return false;
    const parsed = parseCommitTxData(tx.data);
    if (parsed.day !== proof.day || parsed.commitment !== proof.commitment.toLowerCase()) return false;
    if (proof.commitBlockNumber >= input.requestBlockNumber) return false;
    const canonical = await chain.getBlockHash(input.drawBlockNumber);
    return canonical !== null && canonical.toLowerCase() === input.drawBlockHash.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * After reveal: every recorded request for the day has a result that verifies, and each wallet's nonces
 * run 0..n-1 with no gaps. A spin the operator dropped after seeing its draw shows up as missing.
 */
export function verifyDayLog(
  revealedSeed: string,
  commitment: string,
  totalWeight: number,
  requests: SpinRequest[],
  results: Array<{ input: SpinInput; value: number }>,
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const nonces = new Map<string, number[]>();
  for (const r of requests) {
    try {
      assertRequest(r);
    } catch (e) {
      problems.push(`malformed request: ${(e as Error).message}`);
      continue;
    }
    const k = `${r.wallet.toLowerCase()}|${r.day}`;
    nonces.set(k, [...(nonces.get(k) ?? []), r.nonce]);
    const res = results.find((x) => sameRequest(r, x.input));
    if (!res) {
      problems.push(`no result for ${requestLogLine(r)}`);
      continue;
    }
    if (res.input.totalWeight !== totalWeight || !verifySpin(revealedSeed, commitment, res.input, res.value)) {
      problems.push(`result does not verify for ${requestLogLine(r)}`);
    }
  }
  for (const x of results) {
    if (!requests.some((r) => sameRequest(r, x.input))) problems.push(`result without a recorded request: ${x.input.wallet} nonce ${x.input.nonce}`);
  }
  for (const [k, list] of nonces) {
    const sorted = [...list].sort((a, b) => a - b);
    if (sorted.some((n, i) => n !== i)) problems.push(`nonces for ${k} are not contiguous from 0: ${sorted.join(",")}`);
  }
  return { ok: problems.length === 0, problems };
}
