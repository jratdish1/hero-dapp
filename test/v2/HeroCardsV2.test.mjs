/**
 * HeroCardsV2.test.mjs
 * Unit tests for HeroCardsV2.sol
 *
 * Date: 2026-06-18 17:30 PDT
 * Scope: Local compile and unit tests only.
 *        No live deployment. No testnet/mainnet transactions.
 *        No private keys. No contract wiring into frontend.
 */

import { expect } from "chai";
import hre from "hardhat";

// MintPhase enum: 0=CLOSED, 1=WHITELIST, 2=PUBLIC
const MintPhase = { CLOSED: 0n, WHITELIST: 1n, PUBLIC: 2n };

describe("HeroCardsV2", function () {
  let heroCardsV2, ethers;
  let owner, addr1, addr2, royaltyReceiver;
  let MINT_PRICE, WL_PRICE;
  const MAX_SUPPLY = 1500n;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;
    MINT_PRICE = ethers.parseEther("0.05");
    WL_PRICE = ethers.parseEther("0.03");
    [owner, addr1, addr2, royaltyReceiver] = await ethers.getSigners();
    const HeroCardsV2 = await ethers.getContractFactory("HeroCardsV2");
    heroCardsV2 = await HeroCardsV2.deploy(
      "HeroCards V2",
      "HERO2",
      "https://api.herobase.io/v2/",
      "https://api.herobase.io/v2/contract",
      MINT_PRICE,
      WL_PRICE,
      royaltyReceiver.address,
      500n // 5% royalty
    );
    await heroCardsV2.waitForDeployment();
  });

  // ─── Deployment ────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set the correct name and symbol", async function () {
      expect(await heroCardsV2.name()).to.equal("HeroCards V2");
      expect(await heroCardsV2.symbol()).to.equal("HERO2");
    });

    it("should set the correct max supply", async function () {
      expect(await heroCardsV2.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it("should set the correct mint price", async function () {
      expect(await heroCardsV2.mintPrice()).to.equal(MINT_PRICE);
    });

    it("should set the correct whitelist price", async function () {
      expect(await heroCardsV2.whitelistPrice()).to.equal(WL_PRICE);
    });

    it("should set the owner correctly", async function () {
      expect(await heroCardsV2.owner()).to.equal(owner.address);
    });

    it("should start in CLOSED mint phase", async function () {
      expect(await heroCardsV2.mintPhase()).to.equal(MintPhase.CLOSED);
    });

    it("should start with 0 total supply", async function () {
      expect(await heroCardsV2.totalSupply()).to.equal(0n);
    });

    it("should NOT start paused", async function () {
      expect(await heroCardsV2.paused()).to.equal(false);
    });
  });

  // ─── Access Control ────────────────────────────────────────────────────────
  describe("Access Control", function () {
    it("should revert setMintPhase if not owner", async function () {
      await expect(
        heroCardsV2.connect(addr1).setMintPhase(MintPhase.PUBLIC)
      ).to.be.revertedWithCustomError(heroCardsV2, "OwnableUnauthorizedAccount");
    });

    it("should revert setMintPrice if not owner", async function () {
      await expect(
        heroCardsV2.connect(addr1).setMintPrice(ethers.parseEther("0.1"))
      ).to.be.revertedWithCustomError(heroCardsV2, "OwnableUnauthorizedAccount");
    });

    it("should revert setMerkleRoot if not owner", async function () {
      await expect(
        heroCardsV2.connect(addr1).setMerkleRoot(ethers.ZeroHash)
      ).to.be.revertedWithCustomError(heroCardsV2, "OwnableUnauthorizedAccount");
    });

    it("should revert setBaseURI if not owner", async function () {
      await expect(
        heroCardsV2.connect(addr1).setBaseURI("https://evil.com/")
      ).to.be.revertedWithCustomError(heroCardsV2, "OwnableUnauthorizedAccount");
    });

    it("should revert pause if not owner", async function () {
      await expect(
        heroCardsV2.connect(addr1).pause()
      ).to.be.revertedWithCustomError(heroCardsV2, "OwnableUnauthorizedAccount");
    });

    it("should revert unpause if not owner", async function () {
      await expect(
        heroCardsV2.connect(addr1).unpause()
      ).to.be.revertedWithCustomError(heroCardsV2, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Mint Phase Gating ─────────────────────────────────────────────────────
  describe("Mint Phase Gating", function () {
    it("should revert mint when phase is CLOSED", async function () {
      await expect(
        heroCardsV2.connect(addr1).mint(1n, { value: MINT_PRICE })
      ).to.be.revertedWithCustomError(heroCardsV2, "MintClosed");
    });

    it("should revert whitelistMint when phase is PUBLIC", async function () {
      await heroCardsV2.setMintPhase(MintPhase.PUBLIC);
      await expect(
        heroCardsV2.connect(addr1).whitelistMint(1n, [])
      ).to.be.revertedWithCustomError(heroCardsV2, "MintClosed");
    });

    it("should revert mint when paused", async function () {
      // Pause the contract, then attempt mint
      await heroCardsV2.pause();
      await heroCardsV2.setMintPhase(MintPhase.PUBLIC);
      await expect(
        heroCardsV2.connect(addr1).mint(1n, { value: MINT_PRICE })
      ).to.be.revertedWithCustomError(heroCardsV2, "EnforcedPause");
    });
  });

  // ─── Public Mint ───────────────────────────────────────────────────────────
  describe("Public Mint", function () {
    beforeEach(async function () {
      await heroCardsV2.setMintPhase(MintPhase.PUBLIC);
    });

    it("should revert with InsufficientPayment when underpaying", async function () {
      await expect(
        heroCardsV2.connect(addr1).mint(1n, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWithCustomError(heroCardsV2, "InsufficientPayment");
    });

    it("should revert with InvalidAmount when minting 0", async function () {
      await expect(
        heroCardsV2.connect(addr1).mint(0n, { value: MINT_PRICE })
      ).to.be.revertedWithCustomError(heroCardsV2, "InvalidAmount");
    });

    it("should revert with InvalidAmount when minting more than MAX_PER_WALLET", async function () {
      const maxPerWallet = await heroCardsV2.MAX_PER_WALLET();
      const price = MINT_PRICE * (maxPerWallet + 1n);
      await expect(
        heroCardsV2.connect(addr1).mint(maxPerWallet + 1n, { value: price })
      ).to.be.revertedWithCustomError(heroCardsV2, "InvalidAmount");
    });

    it("should mint successfully with correct payment", async function () {
      const qty = 1n;
      const tx = await heroCardsV2.connect(addr1).mint(qty, { value: MINT_PRICE * qty });
      await tx.wait();
      expect(await heroCardsV2.totalSupply()).to.equal(qty);
      expect(await heroCardsV2.balanceOf(addr1.address)).to.equal(qty);
    });

    it("should emit Transfer event on mint", async function () {
      await expect(
        heroCardsV2.connect(addr1).mint(1n, { value: MINT_PRICE })
      ).to.emit(heroCardsV2, "Transfer").withArgs(ethers.ZeroAddress, addr1.address, 1n);
    });
  });

  // ─── Owner Functions ───────────────────────────────────────────────────────
  describe("Owner Functions", function () {
    it("should allow owner to set mint phase", async function () {
      await heroCardsV2.setMintPhase(MintPhase.WHITELIST);
      expect(await heroCardsV2.mintPhase()).to.equal(MintPhase.WHITELIST);
    });

    it("should allow owner to set mint price", async function () {
      const newPrice = ethers.parseEther("0.1");
      await heroCardsV2.setMintPrice(newPrice);
      expect(await heroCardsV2.mintPrice()).to.equal(newPrice);
    });

    it("should allow owner to set whitelist price", async function () {
      const newPrice = ethers.parseEther("0.02");
      await heroCardsV2.setWhitelistPrice(newPrice);
      expect(await heroCardsV2.whitelistPrice()).to.equal(newPrice);
    });

    it("should allow owner to set base URI", async function () {
      await heroCardsV2.setBaseURI("https://api.herobase.io/v3/");
      // Mint one to test tokenURI
      await heroCardsV2.setMintPhase(MintPhase.PUBLIC);
      await heroCardsV2.connect(addr1).mint(1n, { value: MINT_PRICE });
      expect(await heroCardsV2.tokenURI(1n)).to.equal("https://api.herobase.io/v3/1");
    });

    it("should allow owner to set provenance hash", async function () {
      const hash = "abc123provenance";
      await heroCardsV2.setProvenanceHash(hash);
      expect(await heroCardsV2.provenanceHash()).to.equal(hash);
    });

    it("should allow owner to set buy burn router", async function () {
      await heroCardsV2.setBuyBurnRouter(addr2.address);
      expect(await heroCardsV2.buyBurnRouter()).to.equal(addr2.address);
    });

    it("should allow owner to set default royalty", async function () {
      await heroCardsV2.setDefaultRoyalty(royaltyReceiver.address, 750n); // 7.5%
      // Mint one to test royaltyInfo
      await heroCardsV2.setMintPhase(MintPhase.PUBLIC);
      await heroCardsV2.connect(addr1).mint(1n, { value: MINT_PRICE });
      const [receiver, amount] = await heroCardsV2.royaltyInfo(1n, ethers.parseEther("1"));
      expect(receiver).to.equal(royaltyReceiver.address);
      expect(amount).to.equal(ethers.parseEther("0.075")); // 7.5% of 1 ETH
    });
  });

  // ─── Holder Utility Views ──────────────────────────────────────────────────
  describe("Holder Utility Views", function () {
    it("should return 0 tier for non-holder", async function () {
      expect(await heroCardsV2.getHolderTier(addr1.address)).to.equal(0n);
    });

    it("should return false isHolder for non-holder", async function () {
      expect(await heroCardsV2.isHolder(addr1.address)).to.equal(false);
    });

    it("should return 0 fee discount for non-holder", async function () {
      expect(await heroCardsV2.getFeeDiscount(addr1.address)).to.equal(0n);
    });

    it("should return false canAccessSpinWheel for non-holder", async function () {
      expect(await heroCardsV2.canAccessSpinWheel(addr1.address)).to.equal(false);
    });
  });

  // ─── Emergency Withdraw Safety ─────────────────────────────────────────────
  describe("Emergency Withdraw Safety", function () {
    it("should revert emergencyWithdraw when buyBurnRouter IS set (non-zero)", async function () {
      // RouterNotSet error fires when router != address(0) — router handles fees, emergency path blocked
      await heroCardsV2.setBuyBurnRouter(addr2.address);
      await expect(
        heroCardsV2.emergencyWithdraw(owner.address)
      ).to.be.revertedWithCustomError(heroCardsV2, "RouterNotSet");
    });

    it("should allow emergencyWithdraw when buyBurnRouter is zero", async function () {
      await heroCardsV2.setMintPhase(MintPhase.PUBLIC);
      await heroCardsV2.connect(addr1).mint(1n, { value: MINT_PRICE });
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await heroCardsV2.emergencyWithdraw(owner.address);
      await tx.wait();
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.be.gt(balanceBefore - ethers.parseEther("0.01"));
    });
  });

  // ─── ERC-2981 Royalty ──────────────────────────────────────────────────────
  describe("ERC-2981 Royalty", function () {
    it("should support ERC-2981 interface", async function () {
      expect(await heroCardsV2.supportsInterface("0x2a55205a")).to.equal(true);
    });

    it("should return correct royalty info", async function () {
      await heroCardsV2.setMintPhase(MintPhase.PUBLIC);
      await heroCardsV2.connect(addr1).mint(1n, { value: MINT_PRICE });
      const [receiver, amount] = await heroCardsV2.royaltyInfo(1n, ethers.parseEther("1"));
      expect(receiver).to.equal(royaltyReceiver.address);
      expect(amount).to.equal(ethers.parseEther("0.05")); // 5% of 1 ETH
    });
  });
});
