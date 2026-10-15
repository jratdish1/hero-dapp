/**
 * HeroGovernor.test.mjs
 * Unit tests for HeroGovernor + HeroTimelock (BUILD 2 — on-chain DAO).
 * Vote source: HeroSingleSidedStaking (BUILD 1).
 *
 * Scope: Local compile and unit tests only.
 *        No live deployment. No testnet/mainnet transactions. No private keys.
 */

import { expect } from "chai";
import hre from "hardhat";

const E = (n) => BigInt(n) * 10n ** 18n;
const DAY = 86_400;
const WEEK = 7 * DAY;

// Test parameters (deploy-time values are a VETS decision; see PR body).
const VOTING_DELAY = DAY;
const VOTING_PERIOD = 5 * DAY;
const THRESHOLD = E(1_000);
const QUORUM_PCT = 4n;
const TIMELOCK_DELAY = 2 * DAY;

const S = { Pending: 0n, Active: 1n, Canceled: 2n, Defeated: 3n, Succeeded: 4n, Queued: 5n, Expired: 6n, Executed: 7n };
const AGAINST = 0;
const FOR = 1;

describe("HeroGovernor (BUILD 2)", function () {
  let ethers, provider;
  let hero, staking, timelock, governor;
  let deployer, alice, bob, carol, dave, guardian, stranger;

  async function increase(seconds) {
    await provider.send("evm_increaseTime", [seconds]);
    await provider.send("evm_mine", []);
  }
  async function stake(user, amount) {
    await hero.connect(user).approve(await staking.getAddress(), amount);
    return staking.connect(user).stake(amount);
  }
  async function deployGovernance(opts = {}) {
    const delay = opts.timelockDelay ?? TIMELOCK_DELAY;
    const nonce = await provider.getTransactionCount(deployer.address);
    const predictedGovernor = ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 1 });
    const Timelock = await ethers.getContractFactory("HeroTimelock");
    const tl = await Timelock.deploy(delay, predictedGovernor, guardian.address);
    const Gov = await ethers.getContractFactory("HeroGovernor");
    const gov = await Gov.deploy(
      await staking.getAddress(),
      await tl.getAddress(),
      VOTING_DELAY,
      VOTING_PERIOD,
      THRESHOLD,
      QUORUM_PCT,
    );
    expect(await gov.getAddress()).to.equal(predictedGovernor);
    return { tl, gov };
  }
  function desc(text) {
    return { text, hash: ethers.id(text) };
  }
  async function propose(signer, targets, values, calldatas, text) {
    const d = desc(text);
    await governor.connect(signer).propose(targets, values, calldatas, d.text);
    const id = await governor.hashProposal(targets, values, calldatas, d.hash);
    return { id, descHash: d.hash };
  }
  // Proposal: governance accepts ownership of the staking contract.
  async function acceptOwnershipCall() {
    return {
      targets: [await staking.getAddress()],
      values: [0n],
      calldatas: [staking.interface.encodeFunctionData("acceptOwnership")],
    };
  }
  async function passToSucceeded(p) {
    await increase(VOTING_DELAY + 1);
    await governor.connect(alice).castVote(p.id, FOR);
    await governor.connect(bob).castVote(p.id, FOR);
    await increase(VOTING_PERIOD + 1);
    expect(await governor.state(p.id)).to.equal(S.Succeeded);
  }

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;
    provider = ethers.provider;
    [deployer, alice, bob, carol, dave, guardian, stranger] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20ForTesting");
    hero = await Token.deploy("HERO", "HERO", E(10_000_000));
    for (const u of [alice, bob, carol, dave, stranger]) await hero.transfer(u.address, E(100_000));

    const Staking = await ethers.getContractFactory("HeroSingleSidedStaking");
    staking = await Staking.deploy(deployer.address, await hero.getAddress(), WEEK);

    ({ tl: timelock, gov: governor } = await deployGovernance());

    await stake(alice, E(40_000));
    await stake(bob, E(30_000));
    await stake(carol, E(10_000));
    await increase(1); // proposer votes are read at clock() - 1
  });

  // ─── Wiring ───────────────────────────────────────────────────────────────────────
  describe("Wiring", function () {
    it("votes come from the staking contract on a timestamp clock", async function () {
      expect(await governor.token()).to.equal(await staking.getAddress());
      expect(await governor.CLOCK_MODE()).to.equal("mode=timestamp");
      const latest = (await provider.getBlock("latest")).timestamp;
      expect(await governor.clock()).to.equal(BigInt(latest));
      expect(await governor.timelock()).to.equal(await timelock.getAddress());
    });

    it("settings match deploy values", async function () {
      expect(await governor.votingDelay()).to.equal(BigInt(VOTING_DELAY));
      expect(await governor.votingPeriod()).to.equal(BigInt(VOTING_PERIOD));
      expect(await governor.proposalThreshold()).to.equal(THRESHOLD);
      expect(await governor["quorumNumerator()"]()).to.equal(QUORUM_PCT);
      expect(await timelock.getMinDelay()).to.equal(BigInt(TIMELOCK_DELAY));
    });

    it("timelock roles: governor proposes, guardian only cancels, anyone executes, no admin", async function () {
      const gov = await governor.getAddress();
      const tl = await timelock.getAddress();
      const PROPOSER = await timelock.PROPOSER_ROLE();
      const CANCELLER = await timelock.CANCELLER_ROLE();
      const EXECUTOR = await timelock.EXECUTOR_ROLE();
      const ADMIN = await timelock.DEFAULT_ADMIN_ROLE();

      expect(await timelock.hasRole(PROPOSER, gov)).to.equal(true);
      expect(await timelock.hasRole(CANCELLER, gov)).to.equal(true);
      expect(await timelock.hasRole(EXECUTOR, ethers.ZeroAddress)).to.equal(true);
      expect(await timelock.hasRole(ADMIN, tl)).to.equal(true);

      expect(await timelock.hasRole(CANCELLER, guardian.address)).to.equal(true);
      expect(await timelock.hasRole(PROPOSER, guardian.address)).to.equal(false);
      expect(await timelock.hasRole(ADMIN, guardian.address)).to.equal(false);

      for (const role of [PROPOSER, CANCELLER, ADMIN]) {
        expect(await timelock.hasRole(role, deployer.address)).to.equal(false);
      }
    });

    it("quorum is a percent of total staked HERO at the snapshot", async function () {
      const t = (await provider.getBlock("latest")).timestamp - 1;
      const totalStaked = await staking.getPastTotalSupply(t);
      expect(totalStaked).to.equal(E(80_000));
      expect(await governor.quorum(t)).to.equal((totalStaked * QUORUM_PCT) / 100n);
    });
  });

  // ─── Constructor guards ───────────────────────────────────────────────────────────
  describe("Constructor guards", function () {
    it("governor rejects quorum 0 and quorum over 100", async function () {
      const Gov = await ethers.getContractFactory("HeroGovernor");
      const s = await staking.getAddress();
      const t = await timelock.getAddress();
      await expect(Gov.deploy(s, t, VOTING_DELAY, VOTING_PERIOD, THRESHOLD, 0))
        .to.be.revertedWithCustomError(Gov, "QuorumOutOfRange");
      await expect(Gov.deploy(s, t, VOTING_DELAY, VOTING_PERIOD, THRESHOLD, 101))
        .to.be.revertedWithCustomError(Gov, "QuorumOutOfRange");
    });

    it("governor rejects zero addresses", async function () {
      const Gov = await ethers.getContractFactory("HeroGovernor");
      await expect(
        Gov.deploy(ethers.ZeroAddress, await timelock.getAddress(), VOTING_DELAY, VOTING_PERIOD, THRESHOLD, 4),
      ).to.be.revert(ethers);
      await expect(
        Gov.deploy(await staking.getAddress(), ethers.ZeroAddress, VOTING_DELAY, VOTING_PERIOD, THRESHOLD, 4),
      ).to.be.revertedWithCustomError(Gov, "ZeroAddress");
    });

    it("governor rejects a zero voting period", async function () {
      const Gov = await ethers.getContractFactory("HeroGovernor");
      await expect(
        Gov.deploy(await staking.getAddress(), await timelock.getAddress(), VOTING_DELAY, 0, THRESHOLD, 4),
      ).to.be.revert(ethers);
    });

    it("timelock rejects delay outside 1 hour..30 days and zero addresses", async function () {
      const TL = await ethers.getContractFactory("HeroTimelock");
      await expect(TL.deploy(3599, alice.address, guardian.address)).to.be.revertedWithCustomError(TL, "DelayOutOfRange");
      await expect(TL.deploy(30 * DAY + 1, alice.address, guardian.address)).to.be.revertedWithCustomError(TL, "DelayOutOfRange");
      await expect(TL.deploy(DAY, ethers.ZeroAddress, guardian.address)).to.be.revertedWithCustomError(TL, "ZeroAddress");
      await expect(TL.deploy(DAY, alice.address, ethers.ZeroAddress)).to.be.revertedWithCustomError(TL, "ZeroAddress");
    });

    it("a wrong governor prediction leaves the timelock inert (fails safe)", async function () {
      const TL = await ethers.getContractFactory("HeroTimelock");
      const inert = await TL.deploy(DAY, stranger.address, guardian.address); // nobody real
      expect(await inert.hasRole(await inert.PROPOSER_ROLE(), await governor.getAddress())).to.equal(false);
      expect(await inert.hasRole(await inert.PROPOSER_ROLE(), deployer.address)).to.equal(false);
    });
  });

  // ─── Proposing ────────────────────────────────────────────────────────────────────
  describe("Proposing", function () {
    it("an address with no stake cannot propose", async function () {
      const c = await acceptOwnershipCall();
      await expect(governor.connect(dave).propose(c.targets, c.values, c.calldatas, "x"))
        .to.be.revertedWithCustomError(governor, "GovernorInsufficientProposerVotes");
    });

    it("unstaked HERO in a wallet does not count", async function () {
      expect(await hero.balanceOf(dave.address)).to.be.gt(THRESHOLD);
      expect(await staking.getVotes(dave.address)).to.equal(0n);
    });

    it("a staker at the threshold can propose", async function () {
      await stake(dave, THRESHOLD);
      await increase(1);
      const c = await acceptOwnershipCall();
      const p = await propose(dave, c.targets, c.values, c.calldatas, "dave proposal");
      expect(await governor.state(p.id)).to.equal(S.Pending);
    });
  });

  // ─── Full lifecycle ─────────────────────────────────────────────────────────────────
  describe("Lifecycle", function () {
    it("propose → vote → queue → wait → anyone executes; DAO takes staking ownership", async function () {
      await staking.connect(deployer).transferOwnership(await timelock.getAddress());
      const c = await acceptOwnershipCall();
      const p = await propose(alice, c.targets, c.values, c.calldatas, "DAO accepts staking ownership");

      await passToSucceeded(p);
      await governor.queue(c.targets, c.values, c.calldatas, p.descHash);
      expect(await governor.state(p.id)).to.equal(S.Queued);

      // Too early: timelock delay not passed.
      await expect(governor.execute(c.targets, c.values, c.calldatas, p.descHash)).to.be.revert(ethers);

      await increase(TIMELOCK_DELAY + 1);
      await governor.connect(stranger).execute(c.targets, c.values, c.calldatas, p.descHash);
      expect(await governor.state(p.id)).to.equal(S.Executed);
      expect(await staking.owner()).to.equal(await timelock.getAddress());

      // The old owner key is now powerless.
      await expect(staking.connect(deployer).pause()).to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount");
    });

    it("cannot execute without queueing through the timelock", async function () {
      const c = await acceptOwnershipCall();
      const p = await propose(alice, c.targets, c.values, c.calldatas, "skip queue");
      await passToSucceeded(p);
      await expect(governor.execute(c.targets, c.values, c.calldatas, p.descHash)).to.be.revert(ethers);
    });

    it("a defeated proposal (against majority) cannot be queued", async function () {
      const c = await acceptOwnershipCall();
      const p = await propose(alice, c.targets, c.values, c.calldatas, "against wins");
      await increase(VOTING_DELAY + 1);
      await governor.connect(alice).castVote(p.id, AGAINST);
      await governor.connect(bob).castVote(p.id, FOR);
      await increase(VOTING_PERIOD + 1);
      expect(await governor.state(p.id)).to.equal(S.Defeated);
      await expect(governor.queue(c.targets, c.values, c.calldatas, p.descHash)).to.be.revert(ethers);
    });

    it("a proposal without quorum is defeated even if every vote is FOR", async function () {
      await stake(dave, THRESHOLD); // 1,000 of 81,000 staked < 4% quorum
      await increase(1);
      const c = await acceptOwnershipCall();
      const p = await propose(dave, c.targets, c.values, c.calldatas, "no quorum");
      await increase(VOTING_DELAY + 1);
      await governor.connect(dave).castVote(p.id, FOR);
      await increase(VOTING_PERIOD + 1);
      expect(await governor.state(p.id)).to.equal(S.Defeated);
    });

    it("each address votes once", async function () {
      const c = await acceptOwnershipCall();
      const p = await propose(alice, c.targets, c.values, c.calldatas, "double vote");
      await increase(VOTING_DELAY + 1);
      await governor.connect(alice).castVote(p.id, FOR);
      await expect(governor.connect(alice).castVote(p.id, FOR))
        .to.be.revertedWithCustomError(governor, "GovernorAlreadyCastVote");
    });
  });

  // ─── Snapshot defense ─────────────────────────────────────────────────────────────────
  describe("Snapshot defense", function () {
    it("HERO staked after the snapshot adds zero votes", async function () {
      const c = await acceptOwnershipCall();
      const p = await propose(alice, c.targets, c.values, c.calldatas, "late whale");
      await increase(VOTING_DELAY + 1); // snapshot is now in the past

      await stake(stranger, E(100_000)); // bigger than everyone else combined
      await governor.connect(stranger).castVote(p.id, AGAINST);
      const [against, forVotes] = await governor.proposalVotes(p.id);
      expect(against).to.equal(0n);
      expect(forVotes).to.equal(0n);
    });

    it("a stake inside the voting delay does count (it is before the snapshot)", async function () {
      const c = await acceptOwnershipCall();
      const p = await propose(alice, c.targets, c.values, c.calldatas, "early staker");
      await stake(dave, E(5_000)); // during delay, before snapshot
      await increase(VOTING_DELAY + 1);
      await governor.connect(dave).castVote(p.id, FOR);
      const [, forVotes] = await governor.proposalVotes(p.id);
      expect(forVotes).to.equal(E(5_000));
    });

    it("principal is never locked by voting: a voter can withdraw mid-vote", async function () {
      const c = await acceptOwnershipCall();
      const p = await propose(alice, c.targets, c.values, c.calldatas, "withdraw while voting");
      await increase(VOTING_DELAY + 1);
      await governor.connect(carol).castVote(p.id, FOR);
      const before = await hero.balanceOf(carol.address);
      await staking.connect(carol).withdraw(E(10_000));
      expect(await hero.balanceOf(carol.address)).to.equal(before + E(10_000));
      // Her snapshot vote stands (standard OZ behavior; see PR notes).
      const [, forVotes] = await governor.proposalVotes(p.id);
      expect(forVotes).to.equal(E(10_000));
    });
  });

  // ─── Guardian (multisig) powers ─────────────────────────────────────────────────────────────────
  describe("Guardian multisig", function () {
    it("can cancel a queued operation; the proposal then cannot execute", async function () {
      await staking.connect(deployer).transferOwnership(await timelock.getAddress());
      const c = await acceptOwnershipCall();
      const p = await propose(alice, c.targets, c.values, c.calldatas, "guardian veto");
      await passToSucceeded(p);
      await governor.queue(c.targets, c.values, c.calldatas, p.descHash);

      const salt = ethers.zeroPadValue(
        ethers.toBeHex(BigInt(await governor.getAddress()) << 96n ^ BigInt(p.descHash), 32), 32,
      );
      const opId = await timelock.hashOperationBatch(c.targets, c.values, c.calldatas, ethers.ZeroHash, salt);
      expect(await timelock.isOperationPending(opId)).to.equal(true);

      await timelock.connect(guardian).cancel(opId);
      expect(await governor.state(p.id)).to.equal(S.Canceled);

      await increase(TIMELOCK_DELAY + 1);
      await expect(governor.execute(c.targets, c.values, c.calldatas, p.descHash)).to.be.revert(ethers);
      expect(await staking.owner()).to.equal(deployer.address);
    });

    it("cannot schedule, propose-bypass, or change roles", async function () {
      const c = await acceptOwnershipCall();
      await expect(
        timelock.connect(guardian).scheduleBatch(c.targets, c.values, c.calldatas, ethers.ZeroHash, ethers.ZeroHash, TIMELOCK_DELAY),
      ).to.be.revertedWithCustomError(timelock, "AccessControlUnauthorizedAccount");
      await expect(
        timelock.connect(guardian).grantRole(await timelock.PROPOSER_ROLE(), guardian.address),
      ).to.be.revertedWithCustomError(timelock, "AccessControlUnauthorizedAccount");
      await expect(governor.connect(guardian).propose(c.targets, c.values, c.calldatas, "g"))
        .to.be.revertedWithCustomError(governor, "GovernorInsufficientProposerVotes");
    });

    it("the deployer cannot schedule on the timelock either", async function () {
      const c = await acceptOwnershipCall();
      await expect(
        timelock.connect(deployer).scheduleBatch(c.targets, c.values, c.calldatas, ethers.ZeroHash, ethers.ZeroHash, TIMELOCK_DELAY),
      ).to.be.revertedWithCustomError(timelock, "AccessControlUnauthorizedAccount");
    });
  });

  // ─── Settings ──────────────────────────────────────────────────────────────────────
  describe("Settings", function () {
    it("only a passed proposal can change voting settings", async function () {
      await expect(governor.connect(deployer).setVotingPeriod(DAY))
        .to.be.revertedWithCustomError(governor, "GovernorOnlyExecutor");
      await expect(governor.connect(deployer).updateQuorumNumerator(1))
        .to.be.revertedWithCustomError(governor, "GovernorOnlyExecutor");
    });

    it("a passed proposal changes the voting period through the timelock", async function () {
      const targets = [await governor.getAddress()];
      const values = [0n];
      const calldatas = [governor.interface.encodeFunctionData("setVotingPeriod", [3 * DAY])];
      const p = await propose(alice, targets, values, calldatas, "shorter vote");
      await passToSucceeded(p);
      await governor.queue(targets, values, calldatas, p.descHash);
      await increase(TIMELOCK_DELAY + 1);
      await governor.execute(targets, values, calldatas, p.descHash);
      expect(await governor.votingPeriod()).to.equal(BigInt(3 * DAY));
    });

    // Regression (2026-10-15 audit F-1): quorum floor must hold after deploy.
    it("a passed proposal cannot set quorum to 0 or above 100", async function () {
      const g = await governor.getAddress();
      for (const [n, label] of [[0, "quorum zero"], [101, "quorum 101"]]) {
        const calldatas = [governor.interface.encodeFunctionData("updateQuorumNumerator", [n])];
        const p = await propose(alice, [g], [0n], calldatas, label);
        await passToSucceeded(p);
        await governor.queue([g], [0n], calldatas, p.descHash);
        await increase(TIMELOCK_DELAY + 1);
        await expect(governor.execute([g], [0n], calldatas, p.descHash))
          .to.be.revertedWithCustomError(governor, "QuorumOutOfRange");
      }
      expect(await governor["quorumNumerator()"]()).to.equal(QUORUM_PCT);
    });

    it("a passed proposal can still move quorum inside 1..100", async function () {
      const g = await governor.getAddress();
      const calldatas = [governor.interface.encodeFunctionData("updateQuorumNumerator", [10])];
      const p = await propose(alice, [g], [0n], calldatas, "quorum ten");
      await passToSucceeded(p);
      await governor.queue([g], [0n], calldatas, p.descHash);
      await increase(TIMELOCK_DELAY + 1);
      await governor.execute([g], [0n], calldatas, p.descHash);
      expect(await governor["quorumNumerator()"]()).to.equal(10n);
    });

    // Regression (2026-10-15 audit F-2): timelock delay floor must hold after deploy.
    it("a passed proposal cannot drop the timelock delay below 1 hour or above 30 days", async function () {
      const t = await timelock.getAddress();
      for (const [d, label] of [[0, "delay zero"], [3599, "delay 3599"], [30 * DAY + 1, "delay too long"]]) {
        const calldatas = [timelock.interface.encodeFunctionData("updateDelay", [d])];
        const p = await propose(alice, [t], [0n], calldatas, label);
        await passToSucceeded(p);
        await governor.queue([t], [0n], calldatas, p.descHash);
        await increase(TIMELOCK_DELAY + 1);
        await expect(governor.execute([t], [0n], calldatas, p.descHash))
          .to.be.revertedWithCustomError(timelock, "DelayOutOfRange");
      }
      expect(await timelock.getMinDelay()).to.equal(BigInt(TIMELOCK_DELAY));
    });

    it("a passed proposal can still move the delay inside bounds; no one else can", async function () {
      await expect(timelock.connect(guardian).updateDelay(DAY))
        .to.be.revertedWithCustomError(timelock, "TimelockUnauthorizedCaller");
      const t = await timelock.getAddress();
      const calldatas = [timelock.interface.encodeFunctionData("updateDelay", [3 * DAY])];
      const p = await propose(alice, [t], [0n], calldatas, "delay three days");
      await passToSucceeded(p);
      await governor.queue([t], [0n], calldatas, p.descHash);
      await increase(TIMELOCK_DELAY + 1);
      await governor.execute([t], [0n], calldatas, p.descHash);
      expect(await timelock.getMinDelay()).to.equal(BigInt(3 * DAY));
    });
  });
});
