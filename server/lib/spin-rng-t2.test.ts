import { describe, expect, it } from "vitest";
import {
  commitTxData, commitmentOf, deriveSpinValue, parseCommitTxData, prepareEpoch, revealAllowed, spinValue,
  SpinRngError, verifySpin, type EpochRecord, type SeedStore, type SpinInput,
} from "./spin-rng-t2";

const SEED = "0x" + "11".repeat(32);
const HASH = (n: number) => "0x" + n.toString(16).padStart(64, "0");

function input(over: Partial<SpinInput> = {}): SpinInput {
  return {
    chainId: 369n, wallet: "0x00000000000000000000000000000000000000A1", day: "2026-09-25", tier: "gold",
    nonce: 0, requestBlockNumber: 101, drawBlockNumber: 102, drawBlockHash: HASH(0xabc), totalWeight: 100, ...over,
  };
}

function committed(over: Partial<EpochRecord> = {}): EpochRecord {
  return { day: "2026-09-25", seed: SEED, commitment: commitmentOf(SEED), commitTxHash: HASH(1), commitBlockNumber: 100, ...over };
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
    expect(() => spinValue(null, input())).toThrow(/paused \(fail-closed\)/);
  });
  it("commitment not yet mined pauses spins", () => {
    expect(() => spinValue(committed({ commitTxHash: undefined, commitBlockNumber: undefined }), input())).toThrow(/not on-chain yet/);
  });
  it("spin requested at or before the commit block is refused", () => {
    expect(() => spinValue(committed(), input({ requestBlockNumber: 100, drawBlockNumber: 101 }))).toThrow(/before the commitment/);
  });
  it("draw block must be after the request block", () => {
    expect(() => spinValue(committed(), input({ drawBlockNumber: 101 }))).toThrow(/after the spin request/);
  });
  it("tampered stored seed is refused", () => {
    expect(() => spinValue(committed({ seed: "0x" + "22".repeat(32) }), input())).toThrow(/does not match commitment/);
  });
  it("day mismatch is refused", () => {
    expect(() => spinValue(committed({ day: "2026-09-24" }), input())).toThrow(/does not match spin day/);
  });
  it.each([
    ["bad wallet", { wallet: "0x123" }], ["bad tier", { tier: "platinum" }], ["bad day", { day: "2026-02-30" }],
    ["NaN weight", { totalWeight: Number.NaN }], ["zero weight", { totalWeight: 0 }], ["float nonce", { nonce: 1.5 }],
    ["bad block hash", { drawBlockHash: "0x1234" }], ["zero chain", { chainId: 0n }],
  ])("rejects %s", (_name, over) => {
    expect(() => spinValue(committed(), input(over as Partial<SpinInput>))).toThrow(SpinRngError);
  });
});

describe("determinism and public verification", () => {
  it("same inputs give the same value; the revealed seed verifies it", () => {
    const { value, proof } = spinValue(committed(), input());
    expect(spinValue(committed(), input()).value).toBe(value);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(100);
    expect(verifySpin(SEED, proof.commitment, input(), value)).toBe(true);
  });
  it("wallet case does not change the result", () => {
    expect(deriveSpinValue(SEED, input({ wallet: "0x00000000000000000000000000000000000000a1" })))
      .toBe(deriveSpinValue(SEED, input()));
  });
  it("wrong seed, wrong value or tampered input fail verification", () => {
    const { value, proof } = spinValue(committed(), input());
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
    const { value, proof } = spinValue(await store.get("2026-09-25"), input());
    expect(verifySpin(r.seed, proof.commitment, input(), value)).toBe(true);
  });
});
