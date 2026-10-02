/**
 * HeroSpinVRFConsumer.test.mjs - Tier 3 (Chainlink VRF v2.5) spin randomness on Base.
 * Scope: local compile and unit tests only. Mock coordinator. No deployment, no keys.
 */

import { expect } from "chai";
import hre from "hardhat";

const KEY_HASH_2GWEI = "0x00b81b5a830cb0a4009fbd8904de511e28631e62ce5ad231373d3cdad373ccab"; // Base mainnet, docs.chain.link
const SUB_ID = 123456789n;
const GAS_LIMIT = 100_000;
const CONFIRMATIONS = 3;
const DAY = 86_400;

describe("HeroSpinVRFConsumer (Tier 3)", function () {
  let ethers, provider, consumer, coord, owner, server, alice, stranger;

  async function nextDay() {
    await provider.request({ method: "evm_increaseTime", params: [DAY] });
    await provider.request({ method: "evm_mine", params: [] });
  }

  async function request(wallet = alice.address, tier = 2) {
    const tx = await consumer.connect(server).requestSpin(wallet, tier);
    const rc = await tx.wait();
    const ev = rc.logs.map((l) => { try { return consumer.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "SpinRequested");
    return ev.args;
  }

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;
    provider = conn.provider;
    [owner, server, alice, stranger] = await ethers.getSigners();
    coord = await (await ethers.getContractFactory("MockVRFCoordinatorV2Plus")).deploy();
    consumer = await (await ethers.getContractFactory("HeroSpinVRFConsumer")).deploy(
      await coord.getAddress(), KEY_HASH_2GWEI, SUB_ID, GAS_LIMIT, CONFIRMATIONS, true, owner.address,
    );
    await consumer.connect(owner).setRequester(server.address, true);
  });

  it("sends Chainlink exactly the configured request (fields + extraArgs bytes)", async function () {
    await request();
    const r = await coord.lastRequest();
    expect(r.keyHash).to.equal(KEY_HASH_2GWEI);
    expect(r.subId).to.equal(SUB_ID);
    expect(r.requestConfirmations).to.equal(CONFIRMATIONS);
    expect(r.callbackGasLimit).to.equal(GAS_LIMIT);
    expect(r.numWords).to.equal(1);
    const tag = ethers.dataSlice(ethers.id("VRF ExtraArgsV1"), 0, 4);
    const expected = ethers.concat([tag, ethers.AbiCoder.defaultAbiCoder().encode(["bool"], [true])]);
    expect(r.extraArgs).to.equal(ethers.hexlify(expected));
  });

  it("only allowlisted requesters can ask for a draw", async function () {
    await expect(consumer.connect(stranger).requestSpin(alice.address, 0))
      .to.be.revertedWithCustomError(consumer, "NotRequester");
  });

  it("no rerolls: one spin per wallet per UTC day; the next day opens again", async function () {
    const first = await request();
    await expect(consumer.connect(server).requestSpin(alice.address, 2))
      .to.be.revertedWithCustomError(consumer, "SpinLimitReached");
    await expect(consumer.connect(server).requestSpin(alice.address, 0))
      .to.be.revertedWithCustomError(consumer, "SpinLimitReached"); // changing tier is not a way around the cap
    await nextDay();
    const second = await request();
    expect(second.day).to.equal(first.day + 1n);
    expect(second.spinKey).to.not.equal(first.spinKey);
  });

  it("spin key is public and recomputable: keccak256(abi.encode(wallet, day, tier, nonce))", async function () {
    const ev = await request(alice.address, 1);
    const key = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint32", "uint8", "uint8"], [alice.address, ev.day, 1, 0]));
    expect(ev.spinKey).to.equal(key);
    expect(await consumer.requestIdOfSpin(key)).to.equal(ev.requestId);
  });

  it("only the coordinator can deliver randomness", async function () {
    const ev = await request();
    await expect(consumer.connect(stranger).rawFulfillRandomWords(ev.requestId, [42n]))
      .to.be.revertedWithCustomError(consumer, "OnlyCoordinatorCanFulfill");
  });

  it("stores the word, emits it, and getRequestStatus reports it; measures callback gas", async function () {
    const ev = await request();
    expect((await consumer.getRequestStatus(ev.requestId)).fulfilled).to.equal(false);
    const rc = await (await coord.fulfill(ev.requestId, 777n)).wait();
    const [fulfilled, words] = await consumer.getRequestStatus(ev.requestId);
    expect(fulfilled).to.equal(true);
    expect(words).to.deep.equal([777n]);
    const gasUsed = coord.interface.parseLog(rc.logs.find((l) => l.address === coord.target)).args.gasUsed;
    console.log(`      measured fulfill callback gas: ${gasUsed} (limit ${GAS_LIMIT})`);
    expect(gasUsed * 2n).to.be.lessThan(BigInt(GAS_LIMIT)); // >= 2x headroom
  });

  it("duplicate, unknown and empty deliveries are ignored without reverting", async function () {
    const ev = await request();
    await coord.fulfill(ev.requestId, 1n);
    await coord.fulfill(ev.requestId, 2n); // duplicate: first word stands
    expect((await consumer.getRequestStatus(ev.requestId))[1]).to.deep.equal([1n]);
    const consumerAddr = await consumer.getAddress();
    await expect(coord.fulfillRaw(consumerAddr, 999n, [5n])).not.to.revert(ethers);
    await expect(consumer.getRequestStatus(999n)).to.be.revertedWithCustomError(consumer, "UnknownRequest");
    const ev2 = await (async () => { await nextDay(); return request(); })();
    await expect(coord.fulfillRaw(consumerAddr, ev2.requestId, [])).not.to.revert(ethers);
    expect((await consumer.getRequestStatus(ev2.requestId)).fulfilled).to.equal(false);
  });

  it("pause blocks new requests; owner-only controls; config bounds enforced", async function () {
    await consumer.connect(owner).setPaused(true);
    await expect(consumer.connect(server).requestSpin(alice.address, 0))
      .to.be.revertedWithCustomError(consumer, "RequestsPaused");
    await expect(consumer.connect(stranger).setPaused(false)).to.be.revertedWithCustomError(consumer, "OwnableUnauthorizedAccount");
    await expect(consumer.connect(owner).setConfig(KEY_HASH_2GWEI, SUB_ID, 2_500_001, 3, true))
      .to.be.revertedWithCustomError(consumer, "InvalidConfig");
    await expect(consumer.connect(owner).setConfig(KEY_HASH_2GWEI, SUB_ID, GAS_LIMIT, 201, true))
      .to.be.revertedWithCustomError(consumer, "InvalidConfig");
    await expect(consumer.connect(owner).setConfig(ethers.ZeroHash, SUB_ID, GAS_LIMIT, 3, true))
      .to.be.revertedWithCustomError(consumer, "InvalidConfig");
    await expect(consumer.connect(owner).setMaxSpinsPerDay(0)).to.be.revertedWithCustomError(consumer, "InvalidConfig");
    await expect(consumer.connect(server).requestSpin(alice.address, 3)).to.be.revertedWithCustomError(consumer, "RequestsPaused");
    await consumer.connect(owner).setPaused(false);
    await expect(consumer.connect(server).requestSpin(alice.address, 3)).to.be.revertedWithCustomError(consumer, "InvalidTier");
  });

  it("ownership moves only after the new owner accepts (two-step)", async function () {
    await consumer.connect(owner).transferOwnership(stranger.address);
    expect(await consumer.owner()).to.equal(owner.address);
    await consumer.connect(stranger).acceptOwnership();
    expect(await consumer.owner()).to.equal(stranger.address);
  });
});
