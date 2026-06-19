/**
 * HeroCardsMarketplace.test.mjs
 * Unit tests for HeroCardsMarketplace.sol
 *
 * Date: 2026-06-18 17:10 PDT
 * Scope: Local compile and unit tests only.
 *        No live deployment. No testnet/mainnet transactions.
 *        No private keys.
 */

import { expect } from "chai";
import hre from "hardhat";

describe("HeroCardsMarketplace", function () {
  let marketplace, nftContract, ethers;
  let owner, seller, buyer, feeRecipient;
  let LISTING_PRICE;
  const FEE_BPS = 250n; // 2.5%
  const LISTING_DURATION = 86400n; // 1 day
  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;
    LISTING_PRICE = ethers.parseEther("0.5");
    [owner, seller, buyer, feeRecipient] = await ethers.getSigners();

    // Deploy a minimal ERC-721 mock for testing
    const MockERC721 = await ethers.getContractFactory("MockERC721ForTesting");
    nftContract = await MockERC721.deploy("MockNFT", "MNFT");
    await nftContract.waitForDeployment();

    // Mint token #1 to seller
    await nftContract.mint(seller.address, 1n);

    const Marketplace = await ethers.getContractFactory("HeroCardsMarketplace");
    marketplace = await Marketplace.deploy(FEE_BPS, feeRecipient.address);
    await marketplace.waitForDeployment();
  });

  // ─── Deployment ────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set the correct fee bps", async function () {
      expect(await marketplace.platformFeeBps()).to.equal(FEE_BPS);
    });

    it("should set the correct fee recipient", async function () {
      expect(await marketplace.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("should set the owner correctly", async function () {
      expect(await marketplace.owner()).to.equal(owner.address);
    });

    it("should start with 0 listing count", async function () {
      expect(await marketplace.listingCount()).to.equal(0n);
    });
  });

  // ─── Listing ───────────────────────────────────────────────────────────────
  describe("Listing", function () {
    it("should revert list if NFT not approved", async function () {
      await expect(
        marketplace.connect(seller).list(
          await nftContract.getAddress(),
          1n,
          LISTING_PRICE,
          LISTING_DURATION
        )
      ).to.be.revertedWithCustomError(marketplace, "NotOwnerOrApproved");
    });

    it("should create a listing after approval", async function () {
      await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);
      await marketplace.connect(seller).list(
        await nftContract.getAddress(),
        1n,
        LISTING_PRICE,
        LISTING_DURATION
      );
      expect(await marketplace.listingCount()).to.equal(1n);
    });

    it("should emit Listed event on list", async function () {
      await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);
      await expect(
        marketplace.connect(seller).list(
          await nftContract.getAddress(),
          1n,
          LISTING_PRICE,
          LISTING_DURATION
        )
      ).to.emit(marketplace, "Listed");
    });

    it("should revert list with InvalidPrice if price is 0", async function () {
      await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);
      await expect(
        marketplace.connect(seller).list(
          await nftContract.getAddress(),
          1n,
          0n,
          LISTING_DURATION
        )
      ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
    });
  });

  // ─── Cancel Listing ────────────────────────────────────────────────────────
  describe("Cancel Listing", function () {
    beforeEach(async function () {
      await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);
      await marketplace.connect(seller).list(
        await nftContract.getAddress(),
        1n,
        LISTING_PRICE,
        LISTING_DURATION
      );
    });

    it("should allow seller to cancel listing", async function () {
      await expect(marketplace.connect(seller).cancelListing(1n))
        .to.emit(marketplace, "Cancelled").withArgs(1n);
    });

    it("should revert cancel if not seller", async function () {
      await expect(
        marketplace.connect(buyer).cancelListing(1n)
      ).to.be.revertedWithCustomError(marketplace, "NotSeller");
    });

    it("should revert buy after cancellation", async function () {
      await marketplace.connect(seller).cancelListing(1n);
      await expect(
        marketplace.connect(buyer).buy(1n, { value: LISTING_PRICE })
      ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
    });
  });

  // ─── Buy ───────────────────────────────────────────────────────────────────
  describe("Buy", function () {
    beforeEach(async function () {
      await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);
      await marketplace.connect(seller).list(
        await nftContract.getAddress(),
        1n,
        LISTING_PRICE,
        LISTING_DURATION
      );
    });

    it("should revert buy with InsufficientPayment", async function () {
      await expect(
        marketplace.connect(buyer).buy(1n, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
    });

    it("should transfer NFT to buyer on successful purchase", async function () {
      await marketplace.connect(buyer).buy(1n, { value: LISTING_PRICE });
      expect(await nftContract.ownerOf(1n)).to.equal(buyer.address);
    });

    it("should emit Purchased event on buy", async function () {
      await expect(
        marketplace.connect(buyer).buy(1n, { value: LISTING_PRICE })
      ).to.emit(marketplace, "Purchased").withArgs(1n, buyer.address, LISTING_PRICE);
    });

    it("should send fee to feeRecipient on purchase", async function () {
      const feeBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);
      await marketplace.connect(buyer).buy(1n, { value: LISTING_PRICE });
      const feeBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);
      const expectedFee = (LISTING_PRICE * FEE_BPS) / 10000n;
      expect(feeBalanceAfter - feeBalanceBefore).to.equal(expectedFee);
    });

    it("should revert buy on expired listing", async function () {
      // Use ethers.provider.send — same provider as contract interactions (not a new conn)
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        marketplace.connect(buyer).buy(1n, { value: LISTING_PRICE })
      ).to.be.revertedWithCustomError(marketplace, "ListingExpired");
    });
  });

  // ─── Admin: Set Fee ────────────────────────────────────────────────────────
  describe("Admin: Set Fee", function () {
    it("should allow owner to update fee", async function () {
      await marketplace.setFee(500n, feeRecipient.address);
      expect(await marketplace.platformFeeBps()).to.equal(500n);
    });

    it("should revert setFee if not owner", async function () {
      await expect(
        marketplace.connect(seller).setFee(500n, feeRecipient.address)
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });

    it("should revert setFee if feeBps > 1000 (10%)", async function () {
      await expect(
        marketplace.setFee(1001n, feeRecipient.address)
      ).to.be.revertedWith("Fee too high");
    });

    it("should revert setFee with non-zero feeBps and zero feeRecipient (A+ fix)", async function () {
      await expect(
        marketplace.setFee(250n, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(marketplace, "InvalidFeeConfig");
    });

    it("should allow setFee with zero feeBps and zero feeRecipient", async function () {
      await marketplace.setFee(0n, ethers.ZeroAddress);
      expect(await marketplace.platformFeeBps()).to.equal(0n);
    });
  });

  // ─── A+ Fix: Zero-Duration Listing Guard ───────────────────────────────────
  describe("A+ Fix: Zero-Duration Listing Guard", function () {
    it("should revert list with zero duration (A+ fix)", async function () {
      await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);
      await expect(
        marketplace.connect(seller).list(await nftContract.getAddress(), 1n, LISTING_PRICE, 0n)
      ).to.be.revertedWithCustomError(marketplace, "InvalidDuration");
    });
  });

  // ─── A+ Fix: Constructor Fee Config Guard ─────────────────────────────────
  describe("A+ Fix: Constructor Fee Config Guard", function () {
    it("should revert constructor with non-zero feeBps and zero feeRecipient (A+ fix)", async function () {
      const Marketplace = await ethers.getContractFactory("HeroCardsMarketplace");
      // Deploy with non-zero feeBps and zero feeRecipient — must revert with InvalidFeeConfig
      let reverted = false;
      try {
        await Marketplace.deploy(250n, ethers.ZeroAddress);
      } catch (err) {
        reverted = true;
        expect(err.message).to.include("InvalidFeeConfig");
      }
      expect(reverted).to.equal(true, "Expected constructor to revert with InvalidFeeConfig");
    });
  });

  // ─── A+ Fix: ERC-2981 Royalty Path ─────────────────────────────────────────
  describe("A+ Fix: ERC-2981 Royalty Path", function () {
    let royaltyReceiver;

    beforeEach(async function () {
      [,,,, royaltyReceiver] = await ethers.getSigners();
    });

    it("should distribute royalty to ERC-2981 receiver on buy", async function () {
      // The MockERC721ForTesting supports ERC-2981 via setRoyalty
      // Set 5% royalty on token #1 to royaltyReceiver
      await nftContract.setRoyalty(royaltyReceiver.address, 500n); // 5%

      await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);
      await marketplace.connect(seller).list(
        await nftContract.getAddress(), 1n, LISTING_PRICE, LISTING_DURATION
      );

      const royaltyBefore = await ethers.provider.getBalance(royaltyReceiver.address);
      const sellerBefore = await ethers.provider.getBalance(seller.address);

      await marketplace.connect(buyer).buy(1n, { value: LISTING_PRICE });

      const royaltyAfter = await ethers.provider.getBalance(royaltyReceiver.address);
      const sellerAfter = await ethers.provider.getBalance(seller.address);

      // royalty = 5% of 0.5 ETH = 0.025 ETH
      const expectedRoyalty = LISTING_PRICE * 500n / 10000n;
      expect(royaltyAfter - royaltyBefore).to.equal(expectedRoyalty);

      // platform fee = 2.5% of 0.5 ETH = 0.0125 ETH
      const expectedPlatformFee = LISTING_PRICE * FEE_BPS / 10000n;
      const expectedSellerProceeds = LISTING_PRICE - expectedPlatformFee - expectedRoyalty;
      expect(sellerAfter - sellerBefore).to.equal(expectedSellerProceeds);
    });

    it("should revert buy when platformFee + royaltyFee > price (A+ fix)", async function () {
      // Set royalty to 98% — combined with 2.5% platform fee this exceeds 100%
      await nftContract.setRoyalty(royaltyReceiver.address, 9800n); // 98%

      await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);
      await marketplace.connect(seller).list(
        await nftContract.getAddress(), 1n, LISTING_PRICE, LISTING_DURATION
      );

      await expect(
        marketplace.connect(buyer).buy(1n, { value: LISTING_PRICE })
      ).to.be.revertedWithCustomError(marketplace, "FeesTooHigh");
    });

    it("should treat royalty as zero when no royalty is configured (A+ fix)", async function () {
      // OZ ERC2981 rejects setDefaultRoyalty(address(0), ...) at the contract level.
      // The equivalent coverage scenario is: no royalty configured at all (deleteDefaultRoyalty).
      // The marketplace contract guards royaltyReceiver == address(0) and treats it as zero royalty.
      await nftContract.deleteRoyalty(); // removes any default royalty

      await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);
      await marketplace.connect(seller).list(
        await nftContract.getAddress(), 1n, LISTING_PRICE, LISTING_DURATION
      );

      const sellerBefore = await ethers.provider.getBalance(seller.address);

      // Should succeed — royalty is zero (no royalty configured)
      await marketplace.connect(buyer).buy(1n, { value: LISTING_PRICE });

      const sellerAfter = await ethers.provider.getBalance(seller.address);

      // Seller gets price minus platform fee only (royalty is zero)
      const expectedPlatformFee = LISTING_PRICE * FEE_BPS / 10000n;
      const expectedSellerProceeds = LISTING_PRICE - expectedPlatformFee;
      expect(sellerAfter - sellerBefore).to.equal(expectedSellerProceeds);
    });
  });
});
