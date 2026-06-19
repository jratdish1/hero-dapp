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

  // ─── Pause Blocks Distribution ─────────────────────────────────────────────
  describe("Pause Blocks Distribution", function () {
    it("should revert fund distribution when paused", async function () {
      await router.pause();
      await expect(
        owner.sendTransaction({ to: await router.getAddress(), value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(router, "EnforcedPause");
    });
  });
});
