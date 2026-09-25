/**
 * HeroSingleSidedStaking.test.mjs
 * Unit tests for HeroSingleSidedStaking.sol (BUILD 1 — DAO vote source).
 *
 * Scope: Local compile and unit tests only.
 *        No live deployment. No testnet/mainnet transactions. No private keys.
 */

import { expect } from "chai";
import hre from "hardhat";
import { readFileSync } from "node:fs";

const E = (n) => BigInt(n) * 10n ** 18n;
const DAY = 86_400;
const WEEK = 7 * DAY;

describe("HeroSingleSidedStaking", function () {
  let ethers, provider;
  let hero, staking, other;
  let owner, alice, bob, carol, dave;

  async function increase(seconds) {
    await provider.send("evm_increaseTime", [seconds]);
    await provider.send("evm_mine", []);
  }
  async function now() {
    return (await provider.getBlock("latest")).timestamp;
  }
  async function stake(user, amount) {
    await hero.connect(user).approve(await staking.getAddress(), amount);
    return staking.connect(user).stake(amount);
  }
  async function fund(amount) {
    await hero.connect(owner).approve(await staking.getAddress(), amount);
    return staking.connect(owner).notifyRewardAmount(amount);
  }
  async function assertSolvent() {
    const [held, principal, accruedUnpaid, scheduled] = await staking.rewardReserveStatus();
    expect(held).to.be.gte(principal + accruedUnpaid + scheduled);
    expect(principal).to.equal(await staking.totalSupply());
  }

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;
    provider = ethers.provider;
    [owner, alice, bob, carol, dave] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20ForTesting");
    hero = await Token.deploy("HERO", "HERO", E(10_000_000));
    other = await Token.deploy("OTHER", "OTH", E(1_000));
    for (const u of [alice, bob, carol, dave]) await hero.transfer(u.address, E(100_000));

    const Staking = await ethers.getContractFactory("HeroSingleSidedStaking");
    staking = await Staking.deploy(owner.address, await hero.getAddress(), WEEK);
  });

  // ─── Deployment ────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("stake token == reward token == HERO; owner and duration set", async function () {
      const h = await hero.getAddress();
      expect(await staking.stakingToken()).to.equal(h);
      expect(await staking.rewardsToken()).to.equal(h);
      expect(await staking.owner()).to.equal(owner.address);
      expect(await staking.rewardsDuration()).to.equal(BigInt(WEEK));
      expect(await staking.paused()).to.equal(false);
    });

    it("reverts on zero token, zero owner, bad duration", async function () {
      const Staking = await ethers.getContractFactory("HeroSingleSidedStaking");
      const h = await hero.getAddress();
      await expect(Staking.deploy(owner.address, ethers.ZeroAddress, WEEK))
        .to.be.revertedWithCustomError(staking, "ZeroAddress");
      await expect(Staking.deploy(ethers.ZeroAddress, h, WEEK))
        .to.be.revertedWithCustomError(staking, "OwnableInvalidOwner");
      await expect(Staking.deploy(owner.address, h, 0))
        .to.be.revertedWithCustomError(staking, "InvalidDuration");
      await expect(Staking.deploy(owner.address, h, 366 * DAY))
        .to.be.revertedWithCustomError(staking, "InvalidDuration");
    });

    it("implements every function in client/src/lib/staking-abi.ts with matching types", async function () {
      const src = readFileSync("client/src/lib/staking-abi.ts", "utf8");
      const names = [...src.matchAll(/name:\s*"([A-Za-z]+)",\s*\n\s*inputs/g)].map((m) => m[1]);
      expect(names.length).to.be.greaterThan(10);
      const iface = staking.interface;
      for (const n of names) {
        const frag = iface.getFunction(n);
        expect(frag, `missing ${n}`).to.not.equal(null);
      }
      // Spot-check exact signatures the app calls.
      for (const sig of [
        "totalSupply()", "balanceOf(address)", "earned(address)", "rewardRate()",
        "rewardsDuration()", "periodFinish()", "rewardPerToken()", "lastTimeRewardApplicable()",
        "stakingToken()", "rewardsToken()", "paused()", "stake(uint256)", "withdraw(uint256)",
        "getReward()", "exit()",
      ]) {
        expect(iface.getFunction(sig), sig).to.not.equal(null);
      }
    });

    it("uses a timestamp clock (ERC-6372)", async function () {
      expect(await staking.CLOCK_MODE()).to.equal("mode=timestamp");
      expect(await staking.clock()).to.equal(BigInt(await now()));
    });
  });

  // ─── Stake / withdraw ──────────────────────────────────────────────────────
  describe("Stake and withdraw", function () {
    it("stakes, tracks balances, emits", async function () {
      await expect(stake(alice, E(100))).to.emit(staking, "Staked").withArgs(alice.address, E(100));
      expect(await staking.balanceOf(alice.address)).to.equal(E(100));
      expect(await staking.totalSupply()).to.equal(E(100));
    });

    it("rejects zero stake and zero / excess withdraw", async function () {
      await expect(staking.connect(alice).stake(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
      await stake(alice, E(10));
      await expect(staking.connect(alice).withdraw(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
      await expect(staking.connect(alice).withdraw(E(11)))
        .to.be.revertedWithCustomError(staking, "InsufficientBalance");
    });

    it("withdraw returns exact principal", async function () {
      const start = await hero.balanceOf(alice.address);
      await stake(alice, E(500));
      await expect(staking.connect(alice).withdraw(E(200)))
        .to.emit(staking, "Withdrawn").withArgs(alice.address, E(200));
      await staking.connect(alice).withdraw(E(300));
      expect(await hero.balanceOf(alice.address)).to.equal(start);
      expect(await staking.totalSupply()).to.equal(0n);
    });

    it("credits only the amount actually received (fee-on-transfer safe)", async function () {
      const Fee = await ethers.getContractFactory("MockFeeOnTransferERC20ForTesting");
      const fee = await Fee.deploy(E(1_000_000));
      const Staking = await ethers.getContractFactory("HeroSingleSidedStaking");
      const s = await Staking.deploy(owner.address, await fee.getAddress(), WEEK);
      await fee.approve(await s.getAddress(), E(100));
      await s.stake(E(100));
      expect(await s.balanceOf(owner.address)).to.equal(E(99));
      expect(await fee.balanceOf(await s.getAddress())).to.equal(E(99));
    });
  });

  // ─── Rewards ───────────────────────────────────────────────────────────────
  describe("Rewards", function () {
    it("only owner can fund; zero reward rejected", async function () {
      await expect(staking.connect(alice).notifyRewardAmount(E(1)))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
      await expect(staking.notifyRewardAmount(0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
    });

    it("single staker earns ~the full reward over the period", async function () {
      await stake(alice, E(1_000));
      await expect(fund(E(7_000))).to.emit(staking, "RewardAdded");
      expect(await staking.rewardRate()).to.equal(E(7_000) / BigInt(WEEK));
      await increase(WEEK + 10);
      const earned = await staking.earned(alice.address);
      expect(earned).to.be.closeTo(E(7_000), E(1) / 1000n);
      const before = await hero.balanceOf(alice.address);
      await staking.connect(alice).getReward();
      expect(await hero.balanceOf(alice.address) - before).to.equal(earned);
      await assertSolvent();
    });

    it("splits rewards pro-rata between stakers", async function () {
      await stake(alice, E(1_000));
      await stake(bob, E(3_000));
      await fund(E(4_000));
      await increase(WEEK + 1);
      const a = await staking.earned(alice.address);
      const b = await staking.earned(bob.address);
      expect(a).to.be.closeTo(E(1_000), E(1));
      expect(b).to.be.closeTo(E(3_000), E(1));
    });

    it("exit returns principal + rewards", async function () {
      await stake(alice, E(1_000));
      await fund(E(700));
      await increase(WEEK + 1);
      const earned = await staking.earned(alice.address);
      const before = await hero.balanceOf(alice.address);
      await staking.connect(alice).exit();
      expect(await hero.balanceOf(alice.address) - before).to.equal(E(1_000) + earned);
      expect(await staking.balanceOf(alice.address)).to.equal(0n);
    });

    it("rolls leftover into a new notify mid-period", async function () {
      await stake(alice, E(1_000));
      await fund(E(7_000));
      await increase(WEEK / 2);
      await fund(E(7_000));
      const rate = await staking.rewardRate();
      // ~3.5k leftover + 7k new over one week
      expect(rate * BigInt(WEEK)).to.be.closeTo(E(10_500), E(2));
      await assertSolvent();
    });

    it("setRewardsDuration only after the period ends", async function () {
      await stake(alice, E(1));
      await fund(E(70));
      await expect(staking.setRewardsDuration(DAY)).to.be.revertedWithCustomError(staking, "PeriodNotFinished");
      await increase(WEEK + 1);
      await expect(staking.setRewardsDuration(DAY)).to.emit(staking, "RewardsDurationUpdated").withArgs(DAY);
      await expect(staking.setRewardsDuration(0)).to.be.revertedWithCustomError(staking, "InvalidDuration");
    });
  });

  // ─── Principal exclusion ───────────────────────────────────────────────────
  describe("Principal is never reward funding", function () {
    it("staked principal does not raise the reward rate or show as unallocated", async function () {
      await stake(alice, E(50_000));
      await fund(E(700));
      expect(await staking.rewardRate()).to.equal(E(700) / BigInt(WEEK));
      const [held, principal, accruedUnpaid, scheduled, unallocated] = await staking.rewardReserveStatus();
      expect(principal).to.equal(E(50_000));
      expect(held).to.equal(E(50_700));
      expect(accruedUnpaid + scheduled).to.be.lte(E(700));
      expect(unallocated).to.be.lte(E(1)); // only rounding dust
    });

    it("principal is fully withdrawable after rewards are exhausted", async function () {
      await stake(alice, E(10_000));
      await stake(bob, E(20_000));
      await fund(E(3_000));
      await increase(WEEK + 1);
      await staking.connect(alice).exit();
      await staking.connect(bob).exit();
      expect(await staking.totalSupply()).to.equal(0n);
      // Anything left is only rounding dust from the reward stream, never principal.
      expect(await hero.balanceOf(await staking.getAddress())).to.be.lt(E(1));
    });

    it("rewards accrued while nobody is staked are not owed and stay unallocated", async function () {
      await fund(E(700));
      await increase(WEEK + 1);
      const [, , accruedUnpaid, scheduled, unallocated] = await staking.rewardReserveStatus();
      expect(accruedUnpaid).to.equal(0n);
      expect(scheduled).to.equal(0n);
      expect(unallocated).to.be.closeTo(E(700), E(1));
    });
  });

  // ─── Pause ─────────────────────────────────────────────────────────────────
  describe("Pause", function () {
    it("blocks stake; withdraw, getReward and exit still work", async function () {
      await stake(alice, E(1_000));
      await stake(bob, E(1_000));
      await fund(E(700));
      await increase(DAY);
      await staking.pause();
      await hero.connect(carol).approve(await staking.getAddress(), E(1));
      await expect(staking.connect(carol).stake(E(1))).to.be.revertedWithCustomError(staking, "EnforcedPause");
      await expect(staking.connect(alice).withdraw(E(400))).to.emit(staking, "Withdrawn");
      await expect(staking.connect(alice).getReward()).to.emit(staking, "RewardPaid");
      await expect(staking.connect(bob).exit()).to.emit(staking, "Withdrawn");
      await staking.unpause();
      await expect(staking.connect(carol).stake(E(1))).to.emit(staking, "Staked");
    });

    it("only owner can pause / unpause", async function () {
      await expect(staking.connect(alice).pause()).to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
      await staking.pause();
      await expect(staking.connect(alice).unpause()).to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Owner cannot take principal ───────────────────────────────────────────
  describe("Owner powers are bounded", function () {
    it("recoverERC20 rejects HERO", async function () {
      await stake(alice, E(1_000));
      await expect(staking.recoverERC20(await hero.getAddress(), 1n))
        .to.be.revertedWithCustomError(staking, "CannotRecoverStakingToken");
    });

    it("recoverERC20 works for other tokens, owner only", async function () {
      await other.transfer(await staking.getAddress(), E(5));
      await expect(staking.connect(alice).recoverERC20(await other.getAddress(), E(5)))
        .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
      await expect(staking.recoverERC20(await other.getAddress(), E(5)))
        .to.emit(staking, "Recovered").withArgs(await other.getAddress(), E(5));
    });

    it("renounceOwnership is disabled; ownership transfer is two-step", async function () {
      await expect(staking.renounceOwnership()).to.be.revertedWithCustomError(staking, "RenounceDisabled");
      await staking.transferOwnership(alice.address);
      expect(await staking.owner()).to.equal(owner.address);
      await staking.connect(alice).acceptOwnership();
      expect(await staking.owner()).to.equal(alice.address);
    });

    it("exposes no function that can move HERO to the owner", async function () {
      const writes = staking.interface.fragments
        .filter((f) => f.type === "function" && !["view", "pure"].includes(f.stateMutability))
        .map((f) => f.name)
        .sort();
      expect(writes).to.deep.equal([
        "acceptOwnership", "delegate", "delegateBySig", "exit", "getReward", "notifyRewardAmount",
        "pause", "recoverERC20", "setRewardsDuration", "stake", "transferOwnership", "unpause", "withdraw",
      ].sort());
    });
  });

  // ─── Governance checkpoints ────────────────────────────────────────────────
  describe("Votes (DAO vote source)", function () {
    it("auto-self-delegates on first stake", async function () {
      await stake(alice, E(100));
      expect(await staking.delegates(alice.address)).to.equal(alice.address);
      expect(await staking.getVotes(alice.address)).to.equal(E(100));
    });

    it("getPastVotes / getPastTotalSupply reflect history", async function () {
      await stake(alice, E(100));
      const t1 = await now();
      await increase(10);
      await stake(bob, E(300));
      const t2 = await now();
      await increase(10);
      await staking.connect(alice).withdraw(E(40));
      await increase(10);

      expect(await staking.getPastVotes(alice.address, t1)).to.equal(E(100));
      expect(await staking.getPastVotes(bob.address, t1)).to.equal(0n);
      expect(await staking.getPastTotalSupply(t1)).to.equal(E(100));
      expect(await staking.getPastTotalSupply(t2)).to.equal(E(400));
      expect(await staking.getVotes(alice.address)).to.equal(E(60));
      expect(await staking.getPastTotalSupply((await now()) - 1)).to.equal(E(360));
    });

    it("future timepoints revert", async function () {
      await expect(staking.getPastVotes(alice.address, (await now()) + 100))
        .to.be.revertedWithCustomError(staking, "ERC5805FutureLookup");
    });

    it("re-delegation moves votes; later stakes follow the delegate", async function () {
      await stake(alice, E(100));
      await staking.connect(alice).delegate(bob.address);
      expect(await staking.getVotes(alice.address)).to.equal(0n);
      expect(await staking.getVotes(bob.address)).to.equal(E(100));
      await stake(alice, E(50));
      expect(await staking.getVotes(bob.address)).to.equal(E(150));
      await staking.connect(alice).withdraw(E(150));
      expect(await staking.getVotes(bob.address)).to.equal(0n);
    });

    it("a stake after a snapshot cannot change that snapshot", async function () {
      await stake(alice, E(100));
      await increase(5);
      const snapshot = (await now()) - 1;
      await stake(dave, E(90_000));
      expect(await staking.getPastVotes(dave.address, snapshot)).to.equal(0n);
      expect(await staking.getPastTotalSupply(snapshot)).to.equal(E(100));
    });

    it("total votes always equal total staked", async function () {
      await stake(alice, E(10));
      await stake(bob, E(20));
      await staking.connect(bob).delegate(carol.address);
      await staking.connect(alice).withdraw(E(5));
      const sum = (await staking.getVotes(alice.address)) + (await staking.getVotes(bob.address))
        + (await staking.getVotes(carol.address));
      expect(sum).to.equal(await staking.totalSupply());
    });
  });

  // ─── Randomised solvency ───────────────────────────────────────────────────
  describe("Solvency under random activity", function () {
    it("stays solvent and returns every staker's full principal", async function () {
      this.timeout(120_000);
      let seed = 0x5eed1234n;
      const rnd = (n) => { seed = (seed * 6364136223846793005n + 1442695040888963407n) % (1n << 64n); return Number(seed % BigInt(n)); };
      const users = [alice, bob, carol, dave];
      const principal = new Map(users.map((u) => [u.address, 0n]));
      const startBal = new Map();
      for (const u of users) startBal.set(u.address, await hero.balanceOf(u.address));
      let claimed = 0n;

      await fund(E(5_000));
      for (let i = 0; i < 120; i++) {
        const u = users[rnd(4)];
        const op = rnd(5);
        const bal = await staking.balanceOf(u.address);
        if (op <= 1) {
          const amt = E(1 + rnd(5_000));
          await stake(u, amt);
          principal.set(u.address, principal.get(u.address) + amt);
        } else if (op === 2 && bal > 0n) {
          const amt = bal / BigInt(1 + rnd(3));
          await staking.connect(u).withdraw(amt);
          principal.set(u.address, principal.get(u.address) - amt);
        } else if (op === 3) {
          const b = await hero.balanceOf(u.address);
          await staking.connect(u).getReward();
          claimed += (await hero.balanceOf(u.address)) - b;
        } else if (rnd(10) === 0) {
          await fund(E(1 + rnd(3_000)));
        }
        await increase(1 + rnd(DAY));
        await assertSolvent();
      }
      for (const u of users) {
        const b = await hero.balanceOf(u.address);
        await staking.connect(u).exit();
        claimed += (await hero.balanceOf(u.address)) - b - principal.get(u.address);
      }
      expect(await staking.totalSupply()).to.equal(0n);
      // Every user got back at least their start balance (principal fully returned).
      for (const u of users) expect(await hero.balanceOf(u.address)).to.be.gte(startBal.get(u.address));
      // Paid rewards never exceed what the contract says it paid.
      expect(claimed).to.equal(await staking.totalRewardsPaid());
      expect(await staking.totalRewardsPaid()).to.be.lte(await staking.totalRewardsAccrued());
    });
  });
});
