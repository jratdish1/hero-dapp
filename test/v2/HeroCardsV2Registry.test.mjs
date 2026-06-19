/**
 * HeroCardsV2Registry.test.mjs
 * Unit tests for HeroCardsV2Registry.sol
 *
 * Date: 2026-06-18 17:10 PDT
 * Scope: Local compile and unit tests only.
 *        No live deployment. No testnet/mainnet transactions.
 *        No private keys.
 */

import { expect } from "chai";
import hre from "hardhat";

describe("HeroCardsV2Registry", function () {
  let registry, ethers;
  let owner, addr1, addr2;

  const CHAIN_BASE = 8453n;
  const CHAIN_PULSE = 369n;
  const MODULE_NAME = "HeroCardsV2";
  const MODULE_VERSION = "2.0.0";

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;
    [owner, addr1, addr2] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("HeroCardsV2Registry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
  });

  // ─── Deployment ────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set the owner correctly", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should return empty module list for new chain", async function () {
      const names = await registry.getModuleNames(CHAIN_BASE);
      expect(names.length).to.equal(0);
    });
  });

  // ─── Register Module ───────────────────────────────────────────────────────
  describe("Register Module", function () {
    it("should revert registerModule if not owner", async function () {
      await expect(
        registry.connect(addr1).registerModule(CHAIN_BASE, MODULE_NAME, addr1.address, MODULE_VERSION)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should revert registerModule with zero address", async function () {
      await expect(
        registry.registerModule(CHAIN_BASE, MODULE_NAME, ethers.ZeroAddress, MODULE_VERSION)
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("should register a module successfully", async function () {
      await registry.registerModule(CHAIN_BASE, MODULE_NAME, addr1.address, MODULE_VERSION);
      expect(await registry.getModule(CHAIN_BASE, MODULE_NAME)).to.equal(addr1.address);
    });

    it("should emit ModuleRegistered on registerModule", async function () {
      await expect(
        registry.registerModule(CHAIN_BASE, MODULE_NAME, addr1.address, MODULE_VERSION)
      ).to.emit(registry, "ModuleRegistered")
        .withArgs(CHAIN_BASE, MODULE_NAME, addr1.address, MODULE_VERSION);
    });

    it("should emit ModuleUpdated on re-registration", async function () {
      await registry.registerModule(CHAIN_BASE, MODULE_NAME, addr1.address, MODULE_VERSION);
      await expect(
        registry.registerModule(CHAIN_BASE, MODULE_NAME, addr2.address, "2.1.0")
      ).to.emit(registry, "ModuleUpdated")
        .withArgs(CHAIN_BASE, MODULE_NAME, addr1.address, addr2.address, "2.1.0");
    });

    it("should track module names per chain", async function () {
      await registry.registerModule(CHAIN_BASE, "HeroCardsV2", addr1.address, MODULE_VERSION);
      await registry.registerModule(CHAIN_BASE, "HeroMarketplace", addr2.address, MODULE_VERSION);
      const names = await registry.getModuleNames(CHAIN_BASE);
      expect(names).to.include("HeroCardsV2");
      expect(names).to.include("HeroMarketplace");
      expect(names.length).to.equal(2);
    });

    it("should isolate modules per chain", async function () {
      await registry.registerModule(CHAIN_BASE, MODULE_NAME, addr1.address, MODULE_VERSION);
      // PulseChain should not have this module — getModule returns address(0) for non-ACTIVE
      expect(await registry.getModule(CHAIN_PULSE, MODULE_NAME)).to.equal(ethers.ZeroAddress);
    });
  });

  // ─── Module Status ─────────────────────────────────────────────────────────
  describe("Module Status", function () {
    beforeEach(async function () {
      await registry.registerModule(CHAIN_BASE, MODULE_NAME, addr1.address, MODULE_VERSION);
    });

    it("should start with ACTIVE status", async function () {
      expect(await registry.isModuleActive(CHAIN_BASE, MODULE_NAME)).to.equal(true);
    });

    it("should allow owner to set module status to PAUSED", async function () {
      // ModuleStatus enum: UNKNOWN=0, ACTIVE=1, PAUSED=2, DEPRECATED=3
      await registry.setModuleStatus(CHAIN_BASE, MODULE_NAME, 2); // PAUSED
      expect(await registry.isModuleActive(CHAIN_BASE, MODULE_NAME)).to.equal(false);
    });

    it("should allow owner to set module status to DEPRECATED", async function () {
      // ModuleStatus.DEPRECATED = 3
      await registry.setModuleStatus(CHAIN_BASE, MODULE_NAME, 3);
      expect(await registry.isModuleActive(CHAIN_BASE, MODULE_NAME)).to.equal(false);
    });

    it("should emit ModuleStatusChanged on setModuleStatus", async function () {
      await expect(
        registry.setModuleStatus(CHAIN_BASE, MODULE_NAME, 3)
      ).to.emit(registry, "ModuleStatusChanged").withArgs(CHAIN_BASE, MODULE_NAME, 3n);
    });

    it("should revert setModuleStatus if not owner", async function () {
      await expect(
        registry.connect(addr1).setModuleStatus(CHAIN_BASE, MODULE_NAME, 1)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should revert setModuleStatus for non-existent module", async function () {
      await expect(
        registry.setModuleStatus(CHAIN_BASE, "NonExistentModule", 1)
      ).to.be.revertedWithCustomError(registry, "ModuleNotFound");
    });
  });

  // ─── Get Module Info ───────────────────────────────────────────────────────
  describe("Get Module Info", function () {
    it("should return full module info", async function () {
      await registry.registerModule(CHAIN_BASE, MODULE_NAME, addr1.address, MODULE_VERSION);
      // getModuleInfo returns (addr, status, version, registeredAt, updatedAt)
      const [addr, status, version] = await registry.getModuleInfo(CHAIN_BASE, MODULE_NAME);
      expect(addr).to.equal(addr1.address);
      expect(version).to.equal(MODULE_VERSION);
      expect(status).to.equal(1n); // ACTIVE = 1 in enum {UNKNOWN=0, ACTIVE=1, PAUSED=2, DEPRECATED=3}
    });

    it("should return address(0) for non-existent module via getModule", async function () {
      // getModule returns address(0) for non-ACTIVE modules (does not revert)
      expect(await registry.getModule(CHAIN_BASE, "NonExistentModule")).to.equal(ethers.ZeroAddress);
    });
  });
});
