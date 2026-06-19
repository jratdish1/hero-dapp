/**
 * HeroBuyBurnRouter.test.mjs
 * Unit tests for HeroBuyBurnRouter.sol
 *
 * Date: 2026-06-18 17:10 PDT
 * Scope: Local compile and unit tests only.
 *        No live deployment. No testnet/mainnet transactions.
 *        No private keys.
 */

import { expect } from "chai";
import hre from "hardhat";

describe("HeroBuyBurnRouter", function () {
  let router, ethers;
  let owner, treasury, burnAddr, addr1;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;
    [owner, treasury, burnAddr, addr1] = await ethers.getSigners();

    const Router = await ethers.getContractFactory("HeroBuyBurnRouter");
    // Initial splits: 70% treasury, 30% burn
    router = await Router.deploy(
      [treasury.address, burnAddr.address],
      [7000n, 3000n],
      ["treasury", "burn"]
    );
    await router.waitForDeployment();
  });

  // ─── Deployment ────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set the owner correctly", async function () {
      expect(await router.owner()).to.equal(owner.address);
    });

    it("should initialize with correct split count", async function () {
      expect(await router.getSplitCount()).to.equal(2n);
    });

    it("should initialize with correct split values", async function () {
      const [recipient0, bps0, label0] = await router.getSplit(0);
      expect(recipient0).to.equal(treasury.address);
      expect(bps0).to.equal(7000n);
      expect(label0).to.equal("treasury");

      const [recipient1, bps1, label1] = await router.getSplit(1);
      expect(recipient1).to.equal(burnAddr.address);
      expect(bps1).to.equal(3000n);
      expect(label1).to.equal("burn");
    });
  });

  // ─── Constructor Validation ────────────────────────────────────────────────
  describe("Constructor Validation", function () {
    it("should revert if bps do not sum to 10000", async function () {
      const Router = await ethers.getContractFactory("HeroBuyBurnRouter");
      await expect(
        Router.deploy(
          [treasury.address, burnAddr.address],
          [5000n, 4000n], // only 9000 bps
          ["treasury", "burn"]
        )
      ).to.be.revertedWithCustomError(router, "BpsNotSumTo10000");
    });

    it("should revert if a recipient is zero address", async function () {
      const Router = await ethers.getContractFactory("HeroBuyBurnRouter");
      await expect(
        Router.deploy(
          [ethers.ZeroAddress, burnAddr.address],
          [7000n, 3000n],
          ["treasury", "burn"]
        )
      ).to.be.revertedWithCustomError(router, "ZeroAddress");
    });
  });

  // ─── Fund Distribution ─────────────────────────────────────────────────────
  describe("Fund Distribution", function () {
    it("should distribute funds proportionally on receive()", async function () {
      const amount = ethers.parseEther("1.0");
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      const burnBefore = await ethers.provider.getBalance(burnAddr.address);

      // Send ETH directly to the router (triggers receive())
      await owner.sendTransaction({ to: await router.getAddress(), value: amount });

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      const burnAfter = await ethers.provider.getBalance(burnAddr.address);

      expect(treasuryAfter - treasuryBefore).to.equal(ethers.parseEther("0.7"));
      expect(burnAfter - burnBefore).to.equal(ethers.parseEther("0.3"));
    });

    it("should emit FundsReceived and FundsDistributed on receive()", async function () {
      const amount = ethers.parseEther("0.5");
      await expect(
        owner.sendTransaction({ to: await router.getAddress(), value: amount })
      )
        .to.emit(router, "FundsReceived").withArgs(owner.address, amount)
        .and.to.emit(router, "FundsDistributed").withArgs(amount);
    });
  });

  // ─── Update Splits ─────────────────────────────────────────────────────────
  describe("Update Splits", function () {
    it("should allow owner to update splits", async function () {
      await router.updateSplits(
        [treasury.address, burnAddr.address],
        [6000n, 4000n],
        ["treasury", "burn"]
      );
      const [, bps0] = await router.getSplit(0);
      expect(bps0).to.equal(6000n);
    });

    it("should revert updateSplits if not owner", async function () {
      await expect(
        router.connect(addr1).updateSplits(
          [treasury.address],
          [10000n],
          ["treasury"]
        )
      ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
    });

    it("should revert updateSplits if bps do not sum to 10000", async function () {
      await expect(
        router.updateSplits(
          [treasury.address, burnAddr.address],
          [5000n, 4000n],
          ["treasury", "burn"]
        )
      ).to.be.revertedWithCustomError(router, "BpsNotSumTo10000");
    });

    it("should emit SplitUpdated on updateSplits", async function () {
      await expect(
        router.updateSplits(
          [treasury.address],
          [10000n],
          ["treasury"]
        )
      ).to.emit(router, "SplitUpdated").withArgs(1n);
    });
  });

  // ─── Emergency Withdraw ────────────────────────────────────────────────────
  describe("Emergency Withdraw", function () {
    it("should revert emergencyWithdraw when not paused", async function () {
      await expect(
        router.emergencyWithdraw(owner.address)
      ).to.be.revertedWithCustomError(router, "ExpectedPause");
    });

    it("should allow emergencyWithdraw when paused", async function () {
      // Fund the router without triggering distribute (direct send will distribute)
      // Instead, test by pausing first then sending — but receive() won't work paused
      // So we test the revert path only (no funds to withdraw in paused state)
      await router.pause();
      // No funds in router — should succeed with 0 transfer
      await expect(router.emergencyWithdraw(owner.address))
        .to.emit(router, "EmergencyWithdraw").withArgs(owner.address, 0n);
    });

    it("should revert emergencyWithdraw if not owner", async function () {
      await router.pause();
      await expect(
        router.connect(addr1).emergencyWithdraw(owner.address)
      ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
    });
  });

  // ─── A+ Fix: Paused Receive Behavior (Option B — RouterPaused) ──────────────
  describe("A+ Fix: Paused Receive Behavior (Option B)", function () {
    it("should revert with RouterPaused when paused (A+ fix)", async function () {
      await router.pause();
      await expect(
        owner.sendTransaction({ to: await router.getAddress(), value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(router, "RouterPaused");
    });

    it("should distribute normally when unpaused after pause", async function () {
      await router.pause();
      await router.unpause();
      await expect(
        owner.sendTransaction({ to: await router.getAddress(), value: ethers.parseEther("0.1") })
      ).to.emit(router, "FundsDistributed");
    });
  });

  // ─── A+ Fix: Rounding Remainder to Last Recipient ─────────────────────────
  describe("A+ Fix: Rounding Remainder to Last Recipient", function () {
    it("should send all funds with no dust (last recipient gets remainder)", async function () {
      const [,,,, r1, r2, r3] = await ethers.getSigners();
      const HeroBuyBurnRouter = await ethers.getContractFactory("HeroBuyBurnRouter");
      const testRouter = await HeroBuyBurnRouter.deploy(
        [r1.address, r2.address, r3.address],
        [3334n, 3333n, 3333n],
        ["A", "B", "C"]
      );
      await testRouter.waitForDeployment();

      const amount = ethers.parseEther("0.001");
      const r1Before = await ethers.provider.getBalance(r1.address);
      const r2Before = await ethers.provider.getBalance(r2.address);
      const r3Before = await ethers.provider.getBalance(r3.address);

      await owner.sendTransaction({ to: await testRouter.getAddress(), value: amount });

      const r1After = await ethers.provider.getBalance(r1.address);
      const r2After = await ethers.provider.getBalance(r2.address);
      const r3After = await ethers.provider.getBalance(r3.address);

      const r1Share = r1After - r1Before;
      const r2Share = r2After - r2Before;
      const r3Share = r3After - r3Before;

      expect(r1Share + r2Share + r3Share).to.equal(amount);
      expect(r3Share).to.equal(amount - r1Share - r2Share);
    });
  });

  // ─── A+ Fix: updateSplits Length Mismatch ─────────────────────────────────
  describe("A+ Fix: updateSplits Length Mismatch", function () {
    it("should revert updateSplits with mismatched array lengths (A+ fix)", async function () {
      const [,,,, r1, r2] = await ethers.getSigners();
      await expect(
        router.updateSplits(
          [r1.address, r2.address],
          [5000n, 5000n],
          ["A"]
        )
      ).to.be.revertedWithCustomError(router, "LengthMismatch");
    });

    it("should revert updateSplits when bps do not sum to 10000", async function () {
      const [,,,, r1, r2] = await ethers.getSigners();
      await expect(
        router.updateSplits(
          [r1.address, r2.address],
          [5000n, 4999n],
          ["A", "B"]
        )
      ).to.be.revertedWithCustomError(router, "BpsNotSumTo10000");
    });
  });
});
