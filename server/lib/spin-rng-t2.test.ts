import { describe, expect, it } from "vitest";
import {
  commitTxData, commitmentOf, deriveSpinValue, DRAW_BLOCK_OFFSET, parseCommitTxData, prepareEpoch, recordSpinRequest,
  revealAllowed, spinValue, SpinRngError, verifyDayLog, verifySpin, verifySpinOnChain, type ChainReader, type EpochRecord,
  type SeedStore, type SpinInput, type SpinRequest, type SpinRequestStore,
} from "./spin-rng-t2";

const SEED = "0x" + "11".repeat(32);
const HASH = (n: number) => "0x" + n.toString(16).padStart(64, "0");

function input(over: Partial<SpinInput> = {}): SpinInput {
  return {
    chainId: 369n, wallet: "0x00000000000000000000000000000000000000A1", day: "2026-09-25", tier: "gold",
    nonce: 0, requestBlockNumber: 101, drawBlockNumber: 101 + DRAW_BLOCK_OFFSET, drawBlockHash: HASH(0xabc), totalWeight: 100,
    ...over,
  };
}

function req(i: SpinInput): SpinRequest {
  return { chainId: i.chainId, wallet: i.wallet, day: i.day, tier: i.tier, nonce: i.nonce, requestBlockNumber: i.requestBlockNumber };
}

/** spinValue with the request recorded exactly as drawn. */
function spin(epoch: EpochRecord | null, i: SpinInput) {
  return spinValue(epoch, req(i), i);
}

function committed(over: Partial<EpochRecord> = {}): EpochRecord {
  return { day: "2026-09-25", seed: SEED, commitment: commitmentOf(SEED), commitTxHash: HASH(1), commitBlockNumber: 100, ...over };
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

describe("fail-closed gates (no committed seed = no value spin)", () => {
  it("no seed record pauses spins", () => {
    expect(() => spin(null, input())).toThrow(/paused \(fail-closed\)/);
  });
  it("commitment not yet mined pauses spins", () => {
    expect(() => spin(committed({ commitTxHash: undefined, commitBlockNumber: undefined }), input())).toThrow(/not on-chain yet/);
  });
  it("spin requested at or before the commit block is refused", () => {
    expect(() => spin(committed(), input({ requestBlockNumber: 100, drawBlockNumber: 100 + DRAW_BLOCK_OFFSET })))
      .toThrow(/before the commitment/);
  });
  it.each([101, 102, 104, 200])("draw block %i is refused: it must be request + DRAW_BLOCK_OFFSET", (draw) => {
    expect(() => spin(committed(), input({ drawBlockNumber: draw }))).toThrow(/requestBlockNumber \+ /);
  });
  it("a seed holder cannot verify a value against a chosen later draw block", () => {
    const { value } = spin(committed(), input());
    for (const draw of [104, 105, 150]) {
      expect(verifySpin(SEED, commitmentOf(SEED), input({ drawBlockNumber: draw }), value)).toBe(false);
    }
  });
  it("an unrecorded spin request is refused", () => {
    expect(() => spinValue(committed(), null, input())).toThrow(/not recorded/);
  });
  it("a recorded request with different fields is refused", () => {
    expect(() => spinValue(committed(), req(input({ tier: "bronze" })), input())).toThrow(/not recorded/);
    expect(() => spinValue(committed(), req(input({ nonce: 1 })), input())).toThrow(/not recorded/);
  });
  it("tampered stored seed is refused", () => {
    expect(() => spin(committed({ seed: "0x" + "22".repeat(32) }), input())).toThrow(/does not match commitment/);
  });
  it("day mismatch is refused", () => {
    expect(() => spin(committed({ day: "2026-09-24" }), input())).toThrow(/does not match spin day/);
  });
  it.each([
    ["bad wallet", { wallet: "0x123" }], ["bad tier", { tier: "platinum" }], ["bad day", { day: "2026-02-30" }],
    ["NaN weight", { totalWeight: Number.NaN }], ["zero weight", { totalWeight: 0 }], ["float nonce", { nonce: 1.5 }],
    ["bad block hash", { drawBlockHash: "0x1234" }], ["zero chain", { chainId: 0n }],
  ])("rejects %s", (_name, over) => {
    expect(() => spin(committed(), input(over as Partial<SpinInput>))).toThrow(SpinRngError);
  });
});

describe("determinism and public verification", () => {
  it("same inputs give the same value; the revealed seed verifies it", () => {
    const { value, proof } = spin(committed(), input());
    expect(spin(committed(), input()).value).toBe(value);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(100);
    expect(verifySpin(SEED, proof.commitment, input(), value)).toBe(true);
  });
  it("wallet case does not change the result", () => {
    expect(deriveSpinValue(SEED, input({ wallet: "0x00000000000000000000000000000000000000a1" })))
      .toBe(deriveSpinValue(SEED, input()));
  });
  it("wrong seed, wrong value or tampered input fail verification", () => {
    const { value, proof } = spin(committed(), input());
    expect(verifySpin("0x" + "22".repeat(32), proof.commitment, input(), value)).toBe(false);
    expect(verifySpin(SEED, proof.commitment, input(), (value + 1) % 100)).toBe(false);
    const drawHashes = [0xabd, 0xabe, 0xabf, 0xac0, 0xac1].map(HASH);
    const changed = drawHashes.some((h) => deriveSpinValue(SEED, input({ drawBlockHash: h })) !== value);
    expect(changed).toBe(true);
  });
  it("the draw depends on the future block hash, so a seed holder cannot precompute it", () => {
    const values = new Set(Array.from({ length: 50 }, (_, k) => deriveSpinValue(SEED, input({ drawBlockHash: HASH(k + 1) }))));
    expect(values.size).toBeGreaterThan(30);
  });
});

describe("distribution", () => {
  it("is uniform over 20,000 draws (chi-square, 9 dof, p > 0.001)", () => {
    const counts = new Array(10).fill(0);
    for (let k = 0; k < 20_000; k++) counts[deriveSpinValue(SEED, input({ nonce: k, totalWeight: 10 }))]++;
    const chi = counts.reduce((s, c) => s + (c - 2000) ** 2 / 2000, 0);
    expect(chi).toBeLessThan(27.88);
  });
});

describe("epoch lifecycle", () => {
  it("persists and reads back the seed before returning a commitment; idempotent", async () => {
    const store = new MemStore();
    const r = await prepareEpoch(store, "2026-09-25");
    expect(r.commitment).toBe(commitmentOf(r.seed));
    expect((await store.get("2026-09-25"))?.seed).toBe(r.seed);
    expect((await prepareEpoch(store, "2026-09-25")).seed).toBe(r.seed);
  });
  it("a failed persist yields no commitment to publish", async () => {
    const store = new MemStore();
    store.failInsert = true;
    await expect(prepareEpoch(store, "2026-09-25")).rejects.toThrow("disk full");
    expect(store.rows.size).toBe(0);
  });
  it("a corrupt stored epoch is refused", async () => {
    const store = new MemStore();
    store.rows.set("2026-09-25", { day: "2026-09-25", seed: SEED, commitment: HASH(9) });
    await expect(prepareEpoch(store, "2026-09-25")).rejects.toThrow(/corrupt/);
  });
  it("commit calldata round-trips and rejects foreign data", () => {
    const r = committed();
    expect(parseCommitTxData(commitTxData(r))).toEqual({ day: r.day, commitment: r.commitment });
    expect(() => parseCommitTxData("0x68656c6c6f")).toThrow(SpinRngError);
  });
  it("reveal only after the UTC day has ended", () => {
    expect(revealAllowed("2026-09-25", new Date("2026-09-25T23:59:59Z"))).toBe(false);
    expect(revealAllowed("2026-09-25", new Date("2026-09-26T00:00:00Z"))).toBe(true);
  });
  it("a committed store record drives a full spin", async () => {
    const store = new MemStore();
    const r = await prepareEpoch(store, "2026-09-25");
    await store.setCommit("2026-09-25", HASH(7), 100);
    const { value, proof } = spin(await store.get("2026-09-25"), input());
    expect(verifySpin(r.seed, proof.commitment, input(), value)).toBe(true);
  });
});

describe("spin requests are recorded before the draw", () => {
  const W = "0x00000000000000000000000000000000000000A1";
  const base = { chainId: 369n, wallet: W, day: "2026-09-25", tier: "gold" };

  it("pins the request to the head block and returns the draw block", async () => {
    const store = new MemRequests();
    const { request, drawBlockNumber } = await recordSpinRequest(store, committed(), { ...base, nonce: 0 }, 101);
    expect(request.requestBlockNumber).toBe(101);
    expect(request.wallet).toBe(W.toLowerCase());
    expect(drawBlockNumber).toBe(101 + DRAW_BLOCK_OFFSET);
    const i = input({ wallet: request.wallet });
    const recorded = await store.get(W, "2026-09-25", 0);
    expect(() => spinValue(committed(), recorded, i)).not.toThrow();
  });
  it("nonces must be sequential per wallet and day", async () => {
    const store = new MemRequests();
    await expect(recordSpinRequest(store, committed(), { ...base, nonce: 1 }, 101)).rejects.toThrow(/nonce must be 0/);
    await recordSpinRequest(store, committed(), { ...base, nonce: 0 }, 101);
    await expect(recordSpinRequest(store, committed(), { ...base, nonce: 0 }, 102)).rejects.toThrow(/nonce must be 1/);
    await recordSpinRequest(store, committed(), { ...base, nonce: 1 }, 102);
    expect(store.rows.map((r) => r.nonce)).toEqual([0, 1]);
  });
  it("refuses before the commitment is mined", async () => {
    const store = new MemRequests();
    await expect(recordSpinRequest(store, committed({ commitBlockNumber: undefined, commitTxHash: undefined }), { ...base, nonce: 0 }, 101))
      .rejects.toThrow(/not on-chain yet/);
    await expect(recordSpinRequest(store, committed(), { ...base, nonce: 0 }, 100)).rejects.toThrow(/before the commitment/);
    expect(store.rows).toHaveLength(0);
  });
  it("a request that did not persist yields no draw block", async () => {
    const store = new MemRequests();
    store.dropWrites = true;
    await expect(recordSpinRequest(store, committed(), { ...base, nonce: 0 }, 101)).rejects.toThrow(/did not persist/);
  });
});

describe("day log verification (dropped spins are detectable)", () => {
  const wallets = ["0x00000000000000000000000000000000000000A1", "0x00000000000000000000000000000000000000B2"];
  const inputs = wallets.flatMap((w) => [0, 1, 2].map((n) => input({ wallet: w, nonce: n, requestBlockNumber: 101 + n, drawBlockNumber: 101 + n + DRAW_BLOCK_OFFSET })));
  const requests = inputs.map(req);
  const results = inputs.map((i) => ({ input: i, value: deriveSpinValue(SEED, i) }));
  const C = commitmentOf(SEED);

  it("a complete, honest log verifies", () => {
    expect(verifyDayLog(SEED, C, 100, requests, results)).toEqual({ ok: true, problems: [] });
  });
  it("a recorded request with no result is reported", () => {
    const out = verifyDayLog(SEED, C, 100, requests, results.filter((_, k) => k !== 1));
    expect(out.ok).toBe(false);
    expect(out.problems.join("\n")).toMatch(/no result/);
  });
  it("a request missing from the log leaves a nonce gap", () => {
    const keep = (_: unknown, k: number) => k !== 1;
    const out = verifyDayLog(SEED, C, 100, requests.filter(keep), results.filter(keep));
    expect(out.problems.join("\n")).toMatch(/not contiguous/);
  });
  it("a tampered value, weight or unrecorded result is reported", () => {
    const bad = results.map((r, k) => (k === 0 ? { ...r, value: (r.value + 1) % 100 } : r));
    expect(verifyDayLog(SEED, C, 100, requests, bad).problems.join("\n")).toMatch(/does not verify/);
    expect(verifyDayLog(SEED, C, 50, requests, results).ok).toBe(false);
    const extra = [...results, { input: input({ nonce: 9 }), value: 0 }];
    expect(verifyDayLog(SEED, C, 100, requests, extra).problems.join("\n")).toMatch(/without a recorded request/);
  });
});

describe("on-chain proof checks", () => {
  const OP = "0x00000000000000000000000000000000000000C3";
  const COMMIT_TX = HASH(1);
  const good = () => spin(committed(), input()).proof;
  function chain(over: { from?: string; block?: number | null; data?: string; drawHash?: string | null } = {}): ChainReader {
    return {
      async getBlockHash(n) { return n === 101 + DRAW_BLOCK_OFFSET ? (over.drawHash === undefined ? HASH(0xabc) : over.drawHash) : null; },
      async getTransaction(h) {
        if (h !== COMMIT_TX) return null;
        return { from: over.from ?? OP, to: OP, blockNumber: over.block === undefined ? 100 : over.block, data: over.data ?? commitTxData(committed()) };
      },
    };
  }

  it("accepts a proof whose commit and draw facts match the chain", async () => {
    expect(await verifySpinOnChain(good(), input(), OP, chain())).toBe(true);
  });
  it.each([
    ["commit sent by another address", { from: "0x00000000000000000000000000000000000000D4" }],
    ["commit mined at another block", { block: 99 }],
    ["commit not mined", { block: null }],
    ["commit carries another commitment", { data: commitTxData({ day: "2026-09-25", commitment: HASH(5) }) }],
    ["draw hash is not canonical", { drawHash: HASH(0xdef) }],
    ["draw block unknown", { drawHash: null }],
  ])("rejects: %s", async (_name, over) => {
    expect(await verifySpinOnChain(good(), input(), OP, chain(over))).toBe(false);
  });
  it("rejects a proof that does not match the input, and a reader that throws", async () => {
    expect(await verifySpinOnChain({ ...good(), drawBlockHash: HASH(0xdef) }, input(), OP, chain())).toBe(false);
    const broken: ChainReader = { async getBlockHash() { throw new Error("rpc"); }, async getTransaction() { throw new Error("rpc"); } };
    expect(await verifySpinOnChain(good(), input(), OP, broken)).toBe(false);
  });
});
