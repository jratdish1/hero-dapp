/**
 * HeroSingleSidedStaking.test.mjs
 * Unit tests for contracts/v2/HeroSingleSidedStaking.sol
 *
 * Date: 2026-09-25 PDT
 * Scope: Local compile and unit tests only. No deployment. No testnet/mainnet
 *        transactions. No private keys.
 */

import { expect } from "chai";
import hre from "hardhat";
import { readFileSync } from "node:fs";

const DAY = 86400;
const WEEK = 7 * DAY;

describe("HeroSingleSidedStaking", function () {
  let ethers, staking, hero, owner, alice, bob, carol;
  const E = (n) => ethers.parseEther(String(n));

  async function warp(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }
  async function mine() {
    await ethers.provider.send("evm_mine", []);
  }
  async function fund(amount) {
    await hero.connect(owner).approve(await staking.getAddress(), amount);
    return staking.connect(owner).notifyRewardAmount(amount);
  }
  async function stake(signer, amount) {
    await hero.connect(signer).approve(await staking.getAddress(), amount);
    return staking.connect(signer).stake(amount);
  }
  function near(actual, expected, tol) {
    const d = actual > expected ? actual - expected : expected - actual;
    expect(d <= tol, `|${actual} - ${expected}| > ${tol}`).to.equal(true);
  }

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;
    [owner, alice, bob, carol] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20ForTesting");
    hero = await Mock.deploy("HERO Token", "HERO", E(10_000_000));
    await hero.waitForDeployment();
    for (const s of [alice, bob, carol]) await hero.transfer(s.address, E(100_000));
    const F = await ethers.getContractFactory("HeroSingleSidedStaking");
    staking = await F.deploy(await hero.getAddress(), owner.address, WEEK);
    await staking.waitForDeployment();
  });

  // ─── App ABI parity ─────────────────────────────────────────────────────────
  describe("App ABI compatibility (client/src/lib/staking-abi.ts)", function () {
    it("exposes every function in the app ABI with identical signature and mutability", async function () {
      const src = readFileSync("client/src/lib/staking-abi.ts", "utf8")
        .replace(/export const STAKING_ABI =/, "return")
        .replace(/as const;?\s*$/, "");
      const appAbi = new Function(src)();
      const artifact = await hre.artifacts.readArtifact("HeroSingleSidedStaking");
      expect(appAbi.length).to.equal(15);
      for (const f of appAbi) {
        const m = artifact.abi.find((x) => x.type === "function" && x.name === f.name);
        expect(m, `missing ${f.name}`).to.not.equal(undefined);
        expect(m.inputs.map((i) => i.type)).to.deep.equal(f.inputs.map((i) => i.type));
        expect(m.outputs.map((o) => o.type)).to.deep.equal(f.outputs.map((o) => o.type));
        expect(m.stateMutability).to.equal(f.stateMutability);
      }
    });
  });

  // ─── Deployment ─────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("stake token == reward token == HERO; duration and owner set", async function () {
      expect(await staking.stakingToken()).to.equal(await hero.getAddress());
      expect(await staking.rewardsToken()).to.equal(await hero.getAddress());
      expect(await staking.rewardsDuration()).to.equal(WEEK);
      expect(await staking.owner()).to.equal(owner.address);
      expect(await staking.paused()).to.equal(false);
    });

    it("rejects zero token and out-of-range duration", async function () {
      const F = await ethers.getContractFactory("HeroSingleSidedStaking");
      await expect(F.deploy(ethers.ZeroAddress, owner.address, WEEK))
        .to.be.revertedWithCustomError(staking, "ZeroAddress");
      await expect(F.deploy(await hero.getAddress(), owner.address, 60))
        .to.be.revertedWithCustomError(staking, "InvalidDuration");
      await expect(F.deploy(await hero.getAddress(), owner.address, 3651 * DAY))
        .to.be.revertedWithCustomError(staking, "InvalidDuration");
    });
  });

  // ─── Rewards ─────────────────────────────────────────────────────────────────
  describe("Rewards", function () {
    it("single staker earns the full funded amount over the period", async function () {
      await stake(alice, E(1000));
      await fund(E(7000));
      await warp(WEEK + 10);
      near(await staking.earned(alice.address), E(7000), E("0.001"));
      const before = await hero.balanceOf(alice.address);
      await staking.connect(alice).getReward();
      near((await hero.balanceOf(alice.address)) - before, E(7000), E("0.001"));
    });

    it("two stakers split proportionally to stake", async function () {
      await stake(alice, E(1000));
      await stake(bob, E(3000));
      await fund(E(7000));
      await warp(WEEK + 10);
      near(await staking.earned(alice.address), E(1750), E("0.01"));
      near(await staking.earned(bob.address), E(5250), E("0.01"));
    });

    it("idle time with zero stakers is carried into the next period, not lost", async function () {
      await fund(E(7000));
      await warp(3 * DAY);
      await stake(alice, E(1000)); // ~3000 unemitted -> carry
      near(await staking.unallocatedRewards(), E(3000), E(1));
      await warp(WEEK);
      near(await staking.earned(alice.address), E(4000), E(1));
      await fund(E(7000)); // rolls carry in: 7000 + ~3000
      near((await staking.rewardRate()) * BigInt(WEEK), E(10000), E(1));
      await warp(WEEK + 10);
      near(await staking.earned(alice.address), E(14000), E(2));
    });

    it("topping up mid-period rolls the leftover in", async function () {
      await stake(alice, E(1000));
      await fund(E(7000));
      await warp(WEEK / 2);
      await fund(E(7000)); // 3500 leftover + 7000
      near((await staking.rewardRate()) * BigInt(WEEK), E(10500), E(1));
      await warp(WEEK + 10);
      near(await staking.earned(alice.address), E(14000), E(2));
    });

    it("notify with nothing to schedule reverts RewardRateZero", async function () {
      await expect(staking.notifyRewardAmount(0)).to.be.revertedWithCustomError(staking, "RewardRateZero");
    });

    it("rejects fee-on-transfer tokens on stake", async function () {
      const Fee = await ethers.getContractFactory("MockFeeOnTransferERC20");
      const fee = await Fee.deploy(E(1_000_000));
      const F = await ethers.getContractFactory("HeroSingleSidedStaking");
      const s2 = await F.deploy(await fee.getAddress(), owner.address, WEEK);
      await fee.approve(await s2.getAddress(), E(100));
      await expect(s2.stake(E(100))).to.be.revertedWithCustomError(s2, "UnsupportedToken");
      await fee.approve(await s2.getAddress(), E(700));
      await expect(s2.notifyRewardAmount(E(700))).to.be.revertedWithCustomError(s2, "UnsupportedToken");
    });
  });

  // ─── Principal protection ──────────────────────────────────────────────────
  describe("Principal can never fund rewards or be taken by owner", function () {
    it("staked principal cannot back a reward schedule", async function () {
      await stake(alice, E(100_000));
      // Owner holds no approval; notify must pull new tokens, never use principal.
      await expect(staking.notifyRewardAmount(E(7000))).to.be.revertedWithCustomError(hero, "ERC20InsufficientAllowance");
      await expect(staking.notifyRewardAmount(0)).to.be.revertedWithCustomError(staking, "RewardRateZero");
      expect(await staking.rewardReserve()).to.equal(0n);
    });

    it("owner cannot recover principal or funded rewards; only a true surplus", async function () {
      await stake(alice, E(1000));
      await fund(E(7000));
      const addr = await hero.getAddress();
      await expect(staking.recoverERC20(addr, owner.address, 1n))
        .to.be.revertedWithCustomError(staking, "ExceedsSurplus");
      await hero.transfer(await staking.getAddress(), E(5)); // accidental donation
      await expect(staking.recoverERC20(addr, owner.address, E(5) + 1n))
        .to.be.revertedWithCustomError(staking, "ExceedsSurplus");
      await staking.recoverERC20(addr, carol.address, E(5));
      expect(await hero.balanceOf(carol.address)).to.equal(E(100_005));
    });

    it("stays solvent: balance >= staked + reserve through full lifecycle", async function () {
      await stake(alice, E(1000));
      await stake(bob, E(2000));
      await fund(E(7000));
      await warp(2 * DAY);
      await stake(carol, E(500));
      await staking.connect(alice).getReward();
      await warp(3 * DAY);
      await staking.connect(bob).withdraw(E(1500));
      await warp(3 * DAY);
      const addr = await staking.getAddress();
      expect(await hero.balanceOf(addr)).to.be.gte((await staking.totalSupply()) + (await staking.rewardReserve()));
      for (const s of [alice, bob, carol]) await staking.connect(s).exit();
      expect(await staking.totalSupply()).to.equal(0n);
      const bal = await hero.balanceOf(addr);
      expect(bal).to.equal(await staking.rewardReserve());
      expect(bal < E("0.001")).to.equal(true); // only rounding dust left
    });

    it("renounceOwnership is disabled", async function () {
      await expect(staking.renounceOwnership()).to.be.revertedWithCustomError(staking, "RenounceDisabled");
    });
  });

  // ─── Pause ─────────────────────────────────────────────────────────────────────
  describe("Pause blocks stake only", function () {
    it("withdraw, getReward and exit work while paused", async function () {
      await stake(alice, E(1000));
      await stake(bob, E(1000));
      await fund(E(7000));
      await warp(DAY);
      await staking.pause();
      await hero.connect(carol).approve(await staking.getAddress(), E(1));
      await expect(staking.connect(carol).stake(E(1))).to.be.revertedWithCustomError(staking, "EnforcedPause");
      await staking.connect(alice).withdraw(E(400));
      await staking.connect(alice).getReward();
      await staking.connect(bob).exit();
      expect(await staking.balanceOf(bob.address)).to.equal(0n);
      expect(await staking.balanceOf(alice.address)).to.equal(E(600));
      await staking.unpause();
      await staking.connect(carol).stake(E(1));
    });
  });

  // ─── Access control and input validation ──────────────────────────────────────
  describe("Access control and validation", function () {
    it("owner-only admin functions", async function () {
      const U = "OwnableUnauthorizedAccount";
      await expect(staking.connect(alice).notifyRewardAmount(1)).to.be.revertedWithCustomError(staking, U);
      await expect(staking.connect(alice).pause()).to.be.revertedWithCustomError(staking, U);
      await expect(staking.connect(alice).setRewardsDuration(WEEK)).to.be.revertedWithCustomError(staking, U);
      await expect(staking.connect(alice).recoverERC20(await hero.getAddress(), alice.address, 1))
        .to.be.revertedWithCustomError(staking, U);
    });

    it("rewardsDuration cannot change during an active period", async function () {
      await stake(alice, E(1));
      await fund(E(7000));
      await expect(staking.setRewardsDuration(2 * WEEK)).to.be.revertedWithCustomError(staking, "PeriodActive");
      await warp(WEEK + 1);
      await staking.setRewardsDuration(2 * WEEK);
      expect(await staking.rewardsDuration()).to.equal(2 * WEEK);
    });

    it("zero / excess amounts revert", async function () {
      await expect(staking.connect(alice).stake(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
      await stake(alice, E(10));
      await expect(staking.connect(alice).withdraw(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
      await expect(staking.connect(alice).withdraw(E(11))).to.be.revertedWithCustomError(staking, "InsufficientStake");
    });

    it("ownership transfer is two-step", async function () {
      await staking.transferOwnership(alice.address);
      expect(await staking.owner()).to.equal(owner.address);
      await staking.connect(alice).acceptOwnership();
      expect(await staking.owner()).to.equal(alice.address);
    });
  });

  // ─── Governance votes ──────────────────────────────────────────────────────────
  describe("Checkpointed voting power (for HeroGovernor)", function () {
    it("first stake auto-self-delegates; votes track staked balance", async function () {
      await stake(alice, E(1000));
      expect(await staking.delegates(alice.address)).to.equal(alice.address);
      expect(await staking.getVotes(alice.address)).to.equal(E(1000));
      await staking.connect(alice).withdraw(E(400));
      expect(await staking.getVotes(alice.address)).to.equal(E(600));
    });

    it("getPastVotes / getPastTotalSupply are immutable after the snapshot", async function () {
      await stake(alice, E(1000));
      await stake(bob, E(500));
      const snap = await ethers.provider.getBlockNumber();
      await mine();
      await staking.connect(alice).exit();       // sells/moves after snapshot
      await stake(carol, E(9000));               // new money after snapshot
      await mine();
      expect(await staking.getPastVotes(alice.address, snap)).to.equal(E(1000));
      expect(await staking.getPastVotes(carol.address, snap)).to.equal(0n);
      expect(await staking.getPastTotalSupply(snap)).to.equal(E(1500));
      expect(await staking.getVotes(alice.address)).to.equal(0n);
    });

    it("delegation moves votes but never principal", async function () {
      await stake(alice, E(1000));
      await staking.connect(alice).delegate(bob.address);
      expect(await staking.getVotes(bob.address)).to.equal(E(1000));
      expect(await staking.getVotes(alice.address)).to.equal(0n);
      expect(await staking.balanceOf(bob.address)).to.equal(0n);
      await stake(alice, E(1)); // existing delegate is kept
      expect(await staking.getVotes(bob.address)).to.equal(E(1001));
      await stake(bob, E(250));
      await stake(carol, E(75));
      await staking.connect(carol).delegate(alice.address);
      let sum = 0n;
      for (const s of [owner, alice, bob, carol]) sum += await staking.getVotes(s.address);
      expect(sum).to.equal(await staking.totalSupply()); // no vote is ever double-counted
    });

    it("unstaked HERO in a wallet has no voting power", async function () {
      expect(await staking.getVotes(carol.address)).to.equal(0n);
    });
  });
});
