/**
 * HeroGovernor.test.mjs
 * Unit tests for contracts/v2/HeroGovernor.sol + HeroTimelock.sol, wired to
 * HeroSingleSidedStaking exactly as docs/governance.md prescribes.
 *
 * Date: 2026-09-25 PDT
 * Scope: Local compile and unit tests only. No deployment. No testnet/mainnet
 *        transactions. No private keys.
 */

import { expect } from "chai";
import hre from "hardhat";

const DAY = 86400;
const WEEK = 7 * DAY;
const MIN_DELAY = 2 * DAY;
const VOTING_DELAY = 1; // blocks
const VOTING_PERIOD = 50; // blocks
const QUORUM_PCT = 4n;
const LATE_QUORUM_EXT = 10; // blocks

// Governor.ProposalState
const S = { Pending: 0n, Active: 1n, Canceled: 2n, Defeated: 3n, Succeeded: 4n, Queued: 5n, Expired: 6n, Executed: 7n };
// GovernorCountingSimple
const V = { Against: 0, For: 1, Abstain: 2 };

describe("HeroGovernor + HeroTimelock (trustless DAO)", function () {
  let ethers, hero, staking, timelock, governor;
  let deployer, multisig, alice, bob, carol, mallory;
  let PROPOSER, EXECUTOR, CANCELLER, ADMIN;
  const E = (n) => ethers.parseEther(String(n));

  async function mine(n) {
    await ethers.provider.send("hardhat_mine", ["0x" + n.toString(16)]);
  }
  async function warp(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }
  async function stake(signer, amount) {
    await hero.connect(signer).approve(await staking.getAddress(), amount);
    await staking.connect(signer).stake(amount);
  }
  function descHash(d) {
    return ethers.id(d);
  }
  async function propose(signer, targets, values, datas, description) {
    const tx = await governor.connect(signer).propose(targets, values, datas, description);
    const rc = await tx.wait();
    const ev = rc.logs.map((l) => { try { return governor.interface.parseLog(l); } catch { return null; } })
      .find((p) => p && p.name === "ProposalCreated");
    return ev.args.proposalId;
  }
  async function passAndExecute(targets, values, datas, description) {
    const id = await propose(alice, targets, values, datas, description);
    await mine(VOTING_DELAY + 1);
    await governor.connect(alice).castVote(id, V.For);
    await mine(VOTING_PERIOD + 1);
    expect(await governor.state(id)).to.equal(S.Succeeded);
    await governor.queue(targets, values, datas, descHash(description));
    await warp(MIN_DELAY + 1);
    await governor.connect(mallory).execute(targets, values, datas, descHash(description)); // anyone executes
    expect(await governor.state(id)).to.equal(S.Executed);
    return id;
  }

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;
    [deployer, multisig, alice, bob, carol, mallory] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20ForTesting");
    hero = await Mock.deploy("HERO Token", "HERO", E(10_000_000));
    for (const s of [alice, bob, carol, mallory]) await hero.transfer(s.address, E(100_000));

    // 1. staking (vote source)
    const St = await ethers.getContractFactory("HeroSingleSidedStaking");
    staking = await St.deploy(await hero.getAddress(), deployer.address, WEEK);
    // 2. timelock: no proposers yet, anyone executes, deployer temp admin
    const TL = await ethers.getContractFactory("HeroTimelock");
    timelock = await TL.deploy(MIN_DELAY, [], [ethers.ZeroAddress], deployer.address);
    // 3. governor
    const G = await ethers.getContractFactory("HeroGovernor");
    governor = await G.deploy(
      await staking.getAddress(), await timelock.getAddress(),
      VOTING_DELAY, VOTING_PERIOD, E(1000), QUORUM_PCT, LATE_QUORUM_EXT,
    );
    PROPOSER = await timelock.PROPOSER_ROLE();
    EXECUTOR = await timelock.EXECUTOR_ROLE();
    CANCELLER = await timelock.CANCELLER_ROLE();
    ADMIN = await timelock.DEFAULT_ADMIN_ROLE();
    // 4. roles
    const g = await governor.getAddress();
    await timelock.grantRole(PROPOSER, g);
    await timelock.grantRole(CANCELLER, g);
    await timelock.grantRole(CANCELLER, multisig.address);
    // 5. deployer gives up admin forever
    await timelock.renounceRole(ADMIN, deployer.address);
    // 6. staking ownership -> timelock (accepted by governance proposal)
    await staking.transferOwnership(await timelock.getAddress());

    // voters: alice 60k (can propose, > quorum), bob 30k, carol 10k => 100k staked
    await stake(alice, E(60_000));
    await stake(bob, E(30_000));
    await stake(carol, E(10_000));
    await mine(1);
  });

  // --- Wiring / trust model ---
  describe("Trust model (who can do what)", function () {
    it("governor reads staked HERO; settings as deployed", async function () {
      expect(await governor.token()).to.equal(await staking.getAddress());
      expect(await governor.timelock()).to.equal(await timelock.getAddress());
      expect(await governor.votingDelay()).to.equal(BigInt(VOTING_DELAY));
      expect(await governor.votingPeriod()).to.equal(BigInt(VOTING_PERIOD));
      expect(await governor.proposalThreshold()).to.equal(E(1000));
      expect(await governor["quorumNumerator()"]()).to.equal(QUORUM_PCT);
      expect(await timelock.getMinDelay()).to.equal(BigInt(MIN_DELAY));
    });

    it("roles: only governor proposes; anyone executes; multisig can only cancel; no admin left", async function () {
      const g = await governor.getAddress();
      expect(await timelock.hasRole(PROPOSER, g)).to.equal(true);
      expect(await timelock.hasRole(CANCELLER, g)).to.equal(true);
      expect(await timelock.hasRole(EXECUTOR, ethers.ZeroAddress)).to.equal(true);
      expect(await timelock.hasRole(CANCELLER, multisig.address)).to.equal(true);
      expect(await timelock.hasRole(PROPOSER, multisig.address)).to.equal(false);
      expect(await timelock.hasRole(ADMIN, deployer.address)).to.equal(false);
      expect(await timelock.hasRole(ADMIN, multisig.address)).to.equal(false);
      expect(await timelock.hasRole(ADMIN, await timelock.getAddress())).to.equal(true);
    });

    it("governor settings change only via a proposal executed by the timelock", async function () {
      const g = await governor.getAddress();
      const data = governor.interface.encodeFunctionData("setVotingPeriod", [VOTING_PERIOD * 2]);
      await passAndExecute([g], [0], [data], "double-voting-period");
      expect(await governor.votingPeriod()).to.equal(BigInt(VOTING_PERIOD * 2));
      expect(await governor.timelock()).to.equal(await timelock.getAddress()); // executor is the timelock
    });

    it("deployer, multisig and strangers cannot schedule on the timelock directly", async function () {
      const t = await staking.getAddress();
      const data = staking.interface.encodeFunctionData("pause");
      for (const s of [deployer, multisig, mallory]) {
        await expect(timelock.connect(s).schedule(t, 0, data, ethers.ZeroHash, ethers.ZeroHash, MIN_DELAY))
          .to.be.revertedWithCustomError(timelock, "AccessControlUnauthorizedAccount");
      }
    });

    it("deployer cannot re-grant itself roles after renouncing admin", async function () {
      await expect(timelock.grantRole(PROPOSER, deployer.address))
        .to.be.revertedWithCustomError(timelock, "AccessControlUnauthorizedAccount");
    });

    it("governance settings can only be changed by governance", async function () {
      await expect(governor.connect(deployer).setVotingPeriod(1))
        .to.be.revertedWithCustomError(governor, "GovernorOnlyExecutor");
    });
  });

  // --- Full lifecycle ---
  describe("Lifecycle: propose -> vote -> queue -> delay -> execute", function () {
    it("DAO accepts staking ownership, then funds rewards and pauses staking via proposals", async function () {
      const st = await staking.getAddress();
      const tl = await timelock.getAddress();
      // proposal 1: timelock accepts ownership of staking
      await passAndExecute([st], [0], [staking.interface.encodeFunctionData("acceptOwnership")], "P1: accept staking ownership");
      expect(await staking.owner()).to.equal(tl);

      // treasury sends 7,000 HERO to the timelock; proposal 2 approves + funds rewards
      await hero.transfer(tl, E(7000));
      const hr = await hero.getAddress();
      await passAndExecute(
        [hr, st], [0, 0],
        [hero.interface.encodeFunctionData("approve", [st, E(7000)]), staking.interface.encodeFunctionData("notifyRewardAmount", [E(7000)])],
        "P2: fund 7000 HERO rewards",
      );
      expect(await staking.rewardReserve()).to.equal(E(7000));

      // proposal 3: pause new stakes
      await passAndExecute([st], [0], [staking.interface.encodeFunctionData("pause")], "P3: pause staking");
      expect(await staking.paused()).to.equal(true);
      // users can still leave while paused
      await staking.connect(bob).exit();
      expect(await staking.balanceOf(bob.address)).to.equal(0n);
    });

    it("cannot execute before the timelock delay", async function () {
      const st = await staking.getAddress();
      const datas = [staking.interface.encodeFunctionData("acceptOwnership")];
      const id = await propose(alice, [st], [0], datas, "early");
      await mine(VOTING_DELAY + 1);
      await governor.connect(alice).castVote(id, V.For);
      await mine(VOTING_PERIOD + 1);
      await governor.queue([st], [0], datas, descHash("early"));
      await expect(governor.execute([st], [0], datas, descHash("early")))
        .to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");
    });
  });

  // --- Voting power integrity ---
  describe("Voting power = staked HERO at snapshot", function () {
    it("stake added after the proposal snapshot does not count", async function () {
      const st = await staking.getAddress();
      const id = await propose(alice, [st], [0], [staking.interface.encodeFunctionData("pause")], "snap-add");
      await stake(mallory, E(100_000)); // bigger than everyone, but late
      await mine(VOTING_DELAY + 1);
      const snap = await governor.proposalSnapshot(id);
      expect(await governor.getVotes(mallory.address, snap)).to.equal(0n);
      await governor.connect(mallory).castVote(id, V.Against);
      const [against] = await governor.proposalVotes(id);
      expect(against).to.equal(0n);
    });

    it("unstaked wallet HERO has no vote; withdrawing after snapshot does not erase a counted vote", async function () {
      const st = await staking.getAddress();
      const id = await propose(alice, [st], [0], [staking.interface.encodeFunctionData("pause")], "snap-keep");
      await mine(VOTING_DELAY + 1);
      expect(await governor.getVotes(deployer.address, await governor.proposalSnapshot(id))).to.equal(0n);
      await governor.connect(bob).castVote(id, V.For);
      await staking.connect(bob).exit();
      const [, forVotes] = await governor.proposalVotes(id);
      expect(forVotes).to.equal(E(30_000));
    });

    it("one vote per address", async function () {
      const st = await staking.getAddress();
      const id = await propose(alice, [st], [0], [staking.interface.encodeFunctionData("pause")], "double");
      await mine(VOTING_DELAY + 1);
      await governor.connect(carol).castVote(id, V.For);
      await expect(governor.connect(carol).castVote(id, V.For))
        .to.be.revertedWithCustomError(governor, "GovernorAlreadyCastVote");
    });

    it("below proposal threshold cannot propose", async function () {
      await stake(mallory, E(999));
      await mine(1);
      const st = await staking.getAddress();
      await expect(governor.connect(mallory).propose([st], [0], [staking.interface.encodeFunctionData("pause")], "spam"))
        .to.be.revertedWithCustomError(governor, "GovernorInsufficientProposerVotes");
    });

    it("quorum is 4% of total staked at snapshot; below quorum is Defeated", async function () {
      const st = await staking.getAddress();
      const id = await propose(alice, [st], [0], [staking.interface.encodeFunctionData("pause")], "low-turnout");
      await mine(VOTING_DELAY + 1);
      expect(await governor.quorum(await governor.proposalSnapshot(id))).to.equal(E(4000)); // 4% of 100k
      await governor.connect(carol).castVote(id, V.Abstain); // 10k abstain counts to quorum...
      await mine(VOTING_PERIOD + LATE_QUORUM_EXT + 1);
      expect(await governor.state(id)).to.equal(S.Defeated); // ...but zero For votes cannot pass
    });

    it("no votes at all = Defeated (no silent pass)", async function () {
      const st = await staking.getAddress();
      const id = await propose(alice, [st], [0], [staking.interface.encodeFunctionData("pause")], "silence");
      await mine(VOTING_DELAY + VOTING_PERIOD + 2);
      expect(await governor.state(id)).to.equal(S.Defeated);
    });
  });

  // --- Emergency veto ---
  describe("Multisig emergency veto (cancel only)", function () {
    it("multisig can cancel a queued operation; proposal becomes Canceled and cannot execute", async function () {
      const st = await staking.getAddress();
      const datas = [staking.interface.encodeFunctionData("acceptOwnership")];
      const id = await propose(alice, [st], [0], datas, "veto-me");
      await mine(VOTING_DELAY + 1);
      await governor.connect(alice).castVote(id, V.For);
      await mine(VOTING_PERIOD + 1);
      await governor.queue([st], [0], datas, descHash("veto-me"));
      // OZ GovernorTimelockControl salt = bytes20(governor) XOR descriptionHash
      const salt = ethers.toBeHex(
        BigInt(ethers.zeroPadBytes(await governor.getAddress(), 32)) ^ BigInt(descHash("veto-me")), 32);
      const opId = await timelock.hashOperationBatch([st], [0], datas, ethers.ZeroHash, salt);
      expect(await timelock.isOperationPending(opId)).to.equal(true);
      await timelock.connect(multisig).cancel(opId);
      expect(await governor.state(id)).to.equal(S.Canceled);
      await warp(MIN_DELAY + 1);
      await expect(governor.execute([st], [0], datas, descHash("veto-me")))
        .to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");
    });

    it("stranger cannot cancel queued operations", async function () {
      await expect(timelock.connect(mallory).cancel(ethers.ZeroHash))
        .to.be.revertedWithCustomError(timelock, "AccessControlUnauthorizedAccount");
    });
  });

  // --- Late quorum protection ---
  describe("Late-quorum protection", function () {
    it("a vote that first reaches quorum near the deadline extends voting", async function () {
      const st = await staking.getAddress();
      const id = await propose(alice, [st], [0], [staking.interface.encodeFunctionData("pause")], "late");
      const originalDeadline = await governor.proposalDeadline(id);
      await mine(VOTING_DELAY + VOTING_PERIOD - 2); // near the end
      await governor.connect(bob).castVote(id, V.For); // For/Abstain count to quorum; reaches it now
      expect(await governor.proposalDeadline(id)).to.be.gt(originalDeadline);
    });
  });
});
