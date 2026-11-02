import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import {
  commitTxData, commitmentOf, deriveSpinValue, DRAW_BLOCK_OFFSET, parseCommitTxData, parseRequestTxData, prepareEpoch,
  recordSpinRequest, requestIntentLine, requestTxData, revealAllowed, spinValue, SpinRngError, verifyDayLog, verifySpin,
  verifySpinOnChain, type ChainReader, type EpochRecord, type SeedStore, type SpinInput, type SpinRequest,
  type SpinRequestIntent, type SpinRequestStore,
} from "./spin-rng-t2";

const SEED = "0x" + "11".repeat(32);
const HASH = (n: number) => "0x" + n.toString(16).padStart(64, "0");
const OP = "0x00000000000000000000000000000000000000c3";
const USER = new ethers.Wallet("0x" + "a1".repeat(32));
const OTHER = new ethers.Wallet("0x" + "b2".repeat(32));
const W = USER.address.toLowerCase();
const DAY = "2026-09-25";
const COMMIT_TX = HASH(1);
const REQ_BLOCK = 101;
const DRAW_BLOCK = REQ_BLOCK + DRAW_BLOCK_OFFSET;

type Tx = { from: string; to: string | null; blockNumber: number | null; data: string };

/** In-memory chain: canonical hashes for blocks 0..head and a tx index. */
class MemChain implements ChainReader {
  head: number;
  txs = new Map<string, Tx>();
  constructor(head: number) { this.head = head; }
  blockHash(n: number) { return HASH(0xb10c0000 + n); }
  async getBlockHash(n: number) { return n <= this.head ? this.blockHash(n) : null; }
  async getTransaction(h: string) { return this.txs.get(h.toLowerCase()) ?? null; }
  add(hash: string, tx: Tx) { this.txs.set(hash.toLowerCase(), tx); return hash; }
}

function intent(over: Partial<SpinRequestIntent> = {}): SpinRequestIntent {
  return { chainId: 369n, wallet: W, day: DAY, tier: "gold", nonce: 0, ...over };
}

/** Wallet signs the intent; `from` sends a tx carrying it, mined in `block`. */
async function minedRequest(chain: MemChain, i: SpinRequestIntent, block: number, opts: { from?: string; signer?: ethers.Wallet } = {}) {
  const signature = await (opts.signer ?? USER).signMessage(requestIntentLine(i));
  const hash = HASH(0x7e000000 + chain.txs.size);
  chain.add(hash, { from: opts.from ?? OP, to: OP, blockNumber: block, data: requestTxData(i, signature) });
  return { hash, signature };
}

function committed(over: Partial<EpochRecord> = {}): EpochRecord {
  return { day: DAY, seed: SEED, commitment: commitmentOf(SEED), commitTxHash: COMMIT_TX, commitBlockNumber: 100, ...over };
}

function withCommit(chain: MemChain, epoch = committed()): MemChain {
  chain.add(COMMIT_TX, { from: OP, to: OP, blockNumber: 100, data: commitTxData(epoch) });
  return chain;
}

function inputFor(chain: MemChain, r: SpinRequest, totalWeight = 100): SpinInput {
  const drawBlockNumber = r.requestBlockNumber + DRAW_BLOCK_OFFSET;
  return { ...r, drawBlockNumber, drawBlockHash: chain.blockHash(drawBlockNumber), totalWeight };
}

class MemRequests implements SpinRequestStore {
  rows: SpinRequest[] = [];
  dropWrites = false;
  async count(wallet: string, day: string) { return this.rows.filter((r) => r.wallet === wallet.toLowerCase() && r.day === day).length; }
  async append(r: SpinRequest) {
    if (this.rows.some((x) => x.wallet === r.wallet && x.day === r.day && x.nonce === r.nonce)) throw new Error("exists");
    if (!this.dropWrites) this.rows.push({ ...r });
  }
  async get(wallet: string, day: string, nonce: number) {
    return this.rows.find((r) => r.wallet === wallet.toLowerCase() && r.day === day && r.nonce === nonce) ?? null;
  }
}

class MemStore implements SeedStore {
  rows = new Map<string, EpochRecord>();
  failInsert = false;
  async get(day: string) { return this.rows.get(day) ?? null; }
  async insert(r: EpochRecord) {
    if (this.failInsert) throw new Error("disk full");
    if (this.rows.has(r.day)) throw new Error("exists");
    this.rows.set(r.day, { ...r });
  }
  async setCommit(day: string, tx: string, block: number) {
    const r = this.rows.get(day);
    if (!r) throw new Error("missing");
    this.rows.set(day, { ...r, commitTxHash: tx, commitBlockNumber: block });
  }
}

/** A request recorded while block REQ_BLOCK is the head, then the chain advances past the draw block. */
async function recordedSpin(i = intent()) {
  const chain = withCommit(new MemChain(REQ_BLOCK));
  const store = new MemRequests();
  const { hash } = await minedRequest(chain, i, REQ_BLOCK);
  const { request } = await recordSpinRequest(store, committed(), i, hash, OP, chain);
  chain.head = DRAW_BLOCK + 5;
  return { chain, store, request, input: inputFor(chain, request) };
}

describe("F2: requests are bound to a mined, signed tx before the draw block exists", () => {
  it("reads the request block from the chain and returns the pinned draw block", async () => {
    const { request } = await recordedSpin();
    expect(request.requestBlockNumber).toBe(REQ_BLOCK);
    expect(request.wallet).toBe(W);
  });
  it("refuses a request once its draw block hash already exists (stale or withheld request)", async () => {
    const chain = withCommit(new MemChain(DRAW_BLOCK));
    const store = new MemRequests();
    const { hash } = await minedRequest(chain, intent(), REQ_BLOCK);
    await expect(recordSpinRequest(store, committed(), intent(), hash, OP, chain)).rejects.toThrow(/draw block already exists/);
    expect(store.rows).toHaveLength(0);
  });
  it("refuses a request tx that is not mined, or unknown", async () => {
    const chain = withCommit(new MemChain(REQ_BLOCK));
    const sig = await USER.signMessage(requestIntentLine(intent()));
    chain.add(HASH(0xdead), { from: OP, to: OP, blockNumber: null, data: requestTxData(intent(), sig) });
    await expect(recordSpinRequest(new MemRequests(), committed(), intent(), HASH(0xdead), OP, chain)).rejects.toThrow(/not mined/);
    await expect(recordSpinRequest(new MemRequests(), committed(), intent(), HASH(0xbeef), OP, chain)).rejects.toThrow(/not mined/);
  });
  it("refuses an intent not signed by the wallet", async () => {
    const chain = withCommit(new MemChain(REQ_BLOCK));
    const { hash } = await minedRequest(chain, intent(), REQ_BLOCK, { signer: OTHER });
    await expect(recordSpinRequest(new MemRequests(), committed(), intent(), hash, OP, chain)).rejects.toThrow(/not signed by the wallet/);
  });
  it("refuses a request tx from a third party, or carrying a different intent", async () => {
    const chain = withCommit(new MemChain(REQ_BLOCK));
    const third = await minedRequest(chain, intent(), REQ_BLOCK, { from: OTHER.address });
    await expect(recordSpinRequest(new MemRequests(), committed(), intent(), third.hash, OP, chain)).rejects.toThrow(/operator or the wallet/);
    const mine = await minedRequest(chain, intent({ tier: "bronze" }), REQ_BLOCK);
    await expect(recordSpinRequest(new MemRequests(), committed(), intent(), mine.hash, OP, chain)).rejects.toThrow(/different intent/);
  });
  it("accepts a request tx sent by the wallet itself", async () => {
    const chain = withCommit(new MemChain(REQ_BLOCK));
    const { hash } = await minedRequest(chain, intent(), REQ_BLOCK, { from: USER.address });
    await expect(recordSpinRequest(new MemRequests(), committed(), intent(), hash, OP, chain)).resolves.toBeTruthy();
  });
  it("refuses a request mined at or before the commit block", async () => {
    const chain = withCommit(new MemChain(REQ_BLOCK));
    const { hash } = await minedRequest(chain, intent(), 100);
    await expect(recordSpinRequest(new MemRequests(), committed(), intent(), hash, OP, chain)).rejects.toThrow(/before the commitment/);
  });
  it("refuses before the commitment is on-chain", async () => {
    const chain = withCommit(new MemChain(REQ_BLOCK));
    const { hash } = await minedRequest(chain, intent(), REQ_BLOCK);
    await expect(recordSpinRequest(new MemRequests(), committed({ commitBlockNumber: undefined, commitTxHash: undefined }), intent(), hash, OP, chain))
      .rejects.toThrow(/not on-chain yet/);
  });
  it("nonces must be sequential per wallet and day", async () => {
    const chain = withCommit(new MemChain(REQ_BLOCK));
    const store = new MemRequests();
    const n1 = await minedRequest(chain, intent({ nonce: 1 }), REQ_BLOCK);
    await expect(recordSpinRequest(store, committed(), intent({ nonce: 1 }), n1.hash, OP, chain)).rejects.toThrow(/nonce must be 0/);
    const n0 = await minedRequest(chain, intent(), REQ_BLOCK);
    await recordSpinRequest(store, committed(), intent(), n0.hash, OP, chain);
    await expect(recordSpinRequest(store, committed(), intent(), n0.hash, OP, chain)).rejects.toThrow(/nonce must be 1/);
    await recordSpinRequest(store, committed(), intent({ nonce: 1 }), n1.hash, OP, chain);
    expect(store.rows.map((r) => r.nonce)).toEqual([0, 1]);
  });
  it("a request that did not persist yields no draw block", async () => {
    const chain = withCommit(new MemChain(REQ_BLOCK));
    const store = new MemRequests();
    store.dropWrites = true;
    const { hash } = await minedRequest(chain, intent(), REQ_BLOCK);
    await expect(recordSpinRequest(store, committed(), intent(), hash, OP, chain)).rejects.toThrow(/did not persist/);
  });
  it("request calldata round-trips and rejects foreign data", async () => {
    const sig = await USER.signMessage(requestIntentLine(intent()));
    const parsed = parseRequestTxData(requestTxData(intent(), sig));
    expect(parsed.intent).toEqual(intent());
    expect(parsed.signature).toBe(sig.toLowerCase());
    expect(() => parseRequestTxData("0x68656c6c6f")).toThrow(SpinRngError);
  });
});

describe("spinValue draws only after every chain fact verifies", () => {
  it("draws, and the revealed seed verifies the value", async () => {
    const { chain, request, input } = await recordedSpin();
    const { value, proof } = await spinValue(committed(), request, input, OP, chain);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(100);
    expect(proof.requestTxHash).toBe(request.requestTxHash);
    expect(verifySpin(SEED, proof.commitment, input, value)).toBe(true);
    expect((await spinValue(committed(), request, input, OP, chain)).value).toBe(value);
  });
  it("refuses while the draw block does not exist yet", async () => {
    const { chain, request, input } = await recordedSpin();
    chain.head = DRAW_BLOCK - 1;
    await expect(spinValue(committed(), request, input, OP, chain)).rejects.toThrow(/chain facts do not verify/);
  });
  it("refuses a non-canonical draw hash", async () => {
    const { chain, request, input } = await recordedSpin();
    await expect(spinValue(committed(), request, { ...input, drawBlockHash: HASH(0xdef) }, OP, chain)).rejects.toThrow(/chain facts do not verify/);
  });
  it("refuses when the request tx vanished (reorg) or the commit tx is from someone else", async () => {
    const a = await recordedSpin();
    a.chain.txs.delete(a.request.requestTxHash);
    await expect(spinValue(committed(), a.request, a.input, OP, a.chain)).rejects.toThrow(/chain facts do not verify/);
    const b = await recordedSpin();
    b.chain.add(COMMIT_TX, { from: OTHER.address, to: OP, blockNumber: 100, data: commitTxData(committed()) });
    await expect(spinValue(committed(), b.request, b.input, OP, b.chain)).rejects.toThrow(/chain facts do not verify/);
  });
  it("refuses an unrecorded or mismatched request", async () => {
    const { chain, request, input } = await recordedSpin();
    await expect(spinValue(committed(), null, input, OP, chain)).rejects.toThrow(/not recorded/);
    await expect(spinValue(committed(), { ...request, tier: "bronze" }, input, OP, chain)).rejects.toThrow(/not recorded/);
  });
  it.each([REQ_BLOCK + 1, REQ_BLOCK + 3, REQ_BLOCK + 50])("draw block %i is refused: it must be request + DRAW_BLOCK_OFFSET", async (draw) => {
    const { chain, request, input } = await recordedSpin();
    await expect(spinValue(committed(), request, { ...input, drawBlockNumber: draw, drawBlockHash: chain.blockHash(draw) }, OP, chain))
      .rejects.toThrow(/requestBlockNumber \+ /);
  });
  it.each([
    ["no seed", null, /paused \(fail-closed\)/],
    ["commit not mined", committed({ commitTxHash: undefined, commitBlockNumber: undefined }), /not on-chain yet/],
    ["tampered seed", committed({ seed: "0x" + "22".repeat(32) }), /does not match commitment/],
    ["day mismatch", committed({ day: "2026-09-24" }), /does not match spin day/],
  ] as const)("fail-closed: %s", async (_n, epoch, err) => {
    const { chain, request, input } = await recordedSpin();
    await expect(spinValue(epoch, request, input, OP, chain)).rejects.toThrow(err);
  });
  it.each([
    ["bad tier", { tier: "platinum" }], ["NaN weight", { totalWeight: Number.NaN }], ["zero weight", { totalWeight: 0 }],
    ["bad block hash", { drawBlockHash: "0x1234" }], ["zero chain", { chainId: 0n }],
  ])("rejects %s", async (_name, over) => {
    const { chain, request, input } = await recordedSpin();
    await expect(spinValue(committed(), request, { ...input, ...(over as Partial<SpinInput>) }, OP, chain)).rejects.toThrow(SpinRngError);
  });
});

describe("public verification", () => {
  it("verifySpinOnChain accepts the real proof and rejects tampering", async () => {
    const { chain, request, input } = await recordedSpin();
    const { proof } = await spinValue(committed(), request, input, OP, chain);
    expect(await verifySpinOnChain(proof, input, OP, chain)).toBe(true);
    expect(await verifySpinOnChain({ ...proof, drawBlockHash: HASH(0xdef) }, input, OP, chain)).toBe(false);
    expect(await verifySpinOnChain(proof, input, OTHER.address, chain)).toBe(false);
    expect(await verifySpinOnChain(proof, { ...input, requestBlockNumber: 100, drawBlockNumber: 102 }, OP, chain)).toBe(false);
    const broken: ChainReader = { async getBlockHash() { throw new Error("rpc"); }, async getTransaction() { throw new Error("rpc"); } };
    expect(await verifySpinOnChain(proof, input, OP, broken)).toBe(false);
  });
  it("wrong seed, wrong value or another draw block fail verifySpin", async () => {
    const { chain, request, input } = await recordedSpin();
    const { value, proof } = await spinValue(committed(), request, input, OP, chain);
    expect(verifySpin("0x" + "22".repeat(32), proof.commitment, input, value)).toBe(false);
    expect(verifySpin(SEED, proof.commitment, input, (value + 1) % 100)).toBe(false);
    for (const draw of [REQ_BLOCK + 3, REQ_BLOCK + 4]) {
      expect(verifySpin(SEED, proof.commitment, { ...input, drawBlockNumber: draw }, value)).toBe(false);
    }
  });
  it("wallet case does not change the result; the draw depends on the block hash", async () => {
    const { input } = await recordedSpin();
    expect(deriveSpinValue(SEED, { ...input, wallet: input.wallet.toUpperCase().replace("0X", "0x") })).toBe(deriveSpinValue(SEED, input));
    const values = new Set(Array.from({ length: 50 }, (_, k) => deriveSpinValue(SEED, { ...input, drawBlockHash: HASH(k + 1) })));
    expect(values.size).toBeGreaterThan(30);
  });
  it("is uniform over 20,000 draws (chi-square, 9 dof, p > 0.001)", async () => {
    const { input } = await recordedSpin();
    const counts = new Array(10).fill(0);
    for (let k = 0; k < 20_000; k++) counts[deriveSpinValue(SEED, { ...input, nonce: k, totalWeight: 10 })]++;
    const chi = counts.reduce((s, c) => s + (c - 2000) ** 2 / 2000, 0);
    expect(chi).toBeLessThan(27.88);
  });
});

describe("day log verification (dropped spins are detectable)", () => {
  async function day() {
    const rows: Array<{ request: SpinRequest; input: SpinInput }> = [];
    for (const signer of [USER, OTHER]) {
      for (const nonce of [0, 1, 2]) {
        const chain = withCommit(new MemChain(REQ_BLOCK + nonce));
        const i = intent({ wallet: signer.address.toLowerCase(), nonce });
        const { hash } = await minedRequest(chain, i, REQ_BLOCK + nonce, { signer });
        const store = new MemRequests();
        for (let k = 0; k < nonce; k++) store.rows.push({ ...i, nonce: k, requestBlockNumber: 0, requestTxHash: HASH(1), signature: "0x" + "00".repeat(65) });
        const { request } = await recordSpinRequest(store, committed(), i, hash, OP, chain);
        rows.push({ request, input: inputFor(chain, request) });
      }
    }
    return {
      requests: rows.map((r) => r.request),
      results: rows.map((r) => ({ input: r.input, value: deriveSpinValue(SEED, r.input) })),
    };
  }
  const C = commitmentOf(SEED);

  it("a complete, honest log verifies", async () => {
    const { requests, results } = await day();
    expect(verifyDayLog(SEED, C, 100, requests, results)).toEqual({ ok: true, problems: [] });
  });
  it("a recorded request with no result is reported", async () => {
    const { requests, results } = await day();
    const out = verifyDayLog(SEED, C, 100, requests, results.filter((_, k) => k !== 1));
    expect(out.ok).toBe(false);
    expect(out.problems.join("\n")).toMatch(/no result/);
  });
  it("a request missing from the log leaves a nonce gap", async () => {
    const { requests, results } = await day();
    const keep = (_: unknown, k: number) => k !== 1;
    expect(verifyDayLog(SEED, C, 100, requests.filter(keep), results.filter(keep)).problems.join("\n")).toMatch(/not contiguous/);
  });
  it("a tampered value, weight or unrecorded result is reported", async () => {
    const { requests, results } = await day();
    const bad = results.map((r, k) => (k === 0 ? { ...r, value: (r.value + 1) % 100 } : r));
    expect(verifyDayLog(SEED, C, 100, requests, bad).problems.join("\n")).toMatch(/does not verify/);
    expect(verifyDayLog(SEED, C, 50, requests, results).ok).toBe(false);
    const extra = [...results, { input: { ...results[0].input, nonce: 9 }, value: 0 }];
    expect(verifyDayLog(SEED, C, 100, requests, extra).problems.join("\n")).toMatch(/without a recorded request/);
  });
});

describe("epoch lifecycle", () => {
  it("persists and reads back the seed before returning a commitment; idempotent", async () => {
    const store = new MemStore();
    const r = await prepareEpoch(store, DAY);
    expect(r.commitment).toBe(commitmentOf(r.seed));
    expect((await store.get(DAY))?.seed).toBe(r.seed);
    expect((await prepareEpoch(store, DAY)).seed).toBe(r.seed);
  });
  it("a failed persist yields no commitment to publish", async () => {
    const store = new MemStore();
    store.failInsert = true;
    await expect(prepareEpoch(store, DAY)).rejects.toThrow("disk full");
    expect(store.rows.size).toBe(0);
  });
  it("a corrupt stored epoch is refused", async () => {
    const store = new MemStore();
    store.rows.set(DAY, { day: DAY, seed: SEED, commitment: HASH(9) });
    await expect(prepareEpoch(store, DAY)).rejects.toThrow(/corrupt/);
  });
  it("commit calldata round-trips and rejects foreign data", () => {
    const r = committed();
    expect(parseCommitTxData(commitTxData(r))).toEqual({ day: r.day, commitment: r.commitment });
    expect(() => parseCommitTxData("0x68656c6c6f")).toThrow(SpinRngError);
  });
  it("reveal only after the UTC day has ended", () => {
    expect(revealAllowed(DAY, new Date("2026-09-25T23:59:59Z"))).toBe(false);
    expect(revealAllowed(DAY, new Date("2026-09-26T00:00:00Z"))).toBe(true);
  });
});
