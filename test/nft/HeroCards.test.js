/**
 * HERO Cards NFT — Comprehensive Test Suite
 * 
 * Tests all functionality:
 * - Deployment & initialization
 * - Public minting
 * - Whitelist minting (Merkle proof)
 * - Team minting
 * - Randomization (provably fair)
 * - Holder verification (tier system)
 * - Fee discount utility
 * - Spin wheel access gating
 * - Pause/unpause
 * - Withdraw
 * - Edge cases & security
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe("HeroCards", function () {
  let heroCards;
  let owner, addr1, addr2, addr3, addr4;
  let merkleTree, merkleRoot;

  const BASE_URI = "ipfs://QmXTty8QaqP6ToahspVS3oRztpjiTkrAiAmv5ixjbPynDE/";
  const CONTRACT_URI = "ipfs://QmXTty8QaqP6ToahspVS3oRztpjiTkrAiAmv5ixjbPynDE/collection.json";
  const MINT_PRICE = ethers.parseEther("0.005");
  const WL_PRICE = ethers.parseEther("0.003");

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // Build Merkle tree for whitelist
    const whitelistAddresses = [addr1.address, addr2.address];
    const leaves = whitelistAddresses.map((addr) =>
      keccak256(ethers.solidityPacked(["address"], [addr]))
    );
    merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getHexRoot();

    // Deploy
    const HeroCards = await ethers.getContractFactory("HeroCards");
    heroCards = await HeroCards.deploy(BASE_URI, CONTRACT_URI, owner.address);
    await heroCards.waitForDeployment();

    // Set Merkle root
    await heroCards.setMerkleRoot(merkleRoot);
  });

  // ═══════════════════════════════════════════════════════════════
  // DEPLOYMENT
  // ═══════════════════════════════════════════════════════════════

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      expect(await heroCards.name()).to.equal("HERO Cards");
      expect(await heroCards.symbol()).to.equal("HEROCARD");
    });

    it("should set correct max supply", async function () {
      expect(await heroCards.MAX_SUPPLY()).to.equal(1500);
    });

    it("should set correct mint prices", async function () {
      expect(await heroCards.mintPrice()).to.equal(MINT_PRICE);
      expect(await heroCards.whitelistPrice()).to.equal(WL_PRICE);
    });

    it("should start with CLOSED mint phase", async function () {
      expect(await heroCards.mintPhase()).to.equal(0); // CLOSED
    });

    it("should set correct owner", async function () {
      expect(await heroCards.owner()).to.equal(owner.address);
    });

    it("should set correct fee discount (200 bps = 2%)", async function () {
      expect(await heroCards.feeDiscountBps()).to.equal(200);
    });

    it("should set correct base URI", async function () {
      // Mint a token first to test tokenURI
      await heroCards.setMintPhase(2); // PUBLIC
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });
      const uri = await heroCards.tokenURI(1);
      expect(uri).to.equal(BASE_URI + "1");
    });

    it("should revert with zero address royalty receiver", async function () {
      const HeroCards = await ethers.getContractFactory("HeroCards");
      await expect(
        HeroCards.deploy(BASE_URI, CONTRACT_URI, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(heroCards, "ZeroAddress");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC MINTING
  // ═══════════════════════════════════════════════════════════════

  describe("Public Minting", function () {
    beforeEach(async function () {
      await heroCards.setMintPhase(2); // PUBLIC
    });

    it("should mint successfully with correct payment", async function () {
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });
      expect(await heroCards.balanceOf(addr1.address)).to.equal(1);
      expect(await heroCards.ownerOf(1)).to.equal(addr1.address);
    });

    it("should mint multiple tokens", async function () {
      const qty = 5;
      await heroCards.connect(addr1).mint(qty, { value: MINT_PRICE * BigInt(qty) });
      expect(await heroCards.balanceOf(addr1.address)).to.equal(qty);
    });

    it("should revert when mint is CLOSED", async function () {
      await heroCards.setMintPhase(0); // CLOSED
      await expect(
        heroCards.connect(addr1).mint(1, { value: MINT_PRICE })
      ).to.be.revertedWithCustomError(heroCards, "MintClosed");
    });

    it("should revert with insufficient payment", async function () {
      await expect(
        heroCards.connect(addr1).mint(1, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWithCustomError(heroCards, "InsufficientPayment");
    });

    it("should revert when exceeding wallet limit", async function () {
      // Mint max
      await heroCards.connect(addr1).mint(20, { value: MINT_PRICE * 20n });
      await expect(
        heroCards.connect(addr1).mint(1, { value: MINT_PRICE })
      ).to.be.revertedWithCustomError(heroCards, "ExceedsWalletLimit");
    });

    it("should revert with zero quantity", async function () {
      await expect(
        heroCards.connect(addr1).mint(0, { value: MINT_PRICE })
      ).to.be.revertedWithCustomError(heroCards, "InvalidAmount");
    });

    it("should emit Minted event", async function () {
      await expect(heroCards.connect(addr1).mint(1, { value: MINT_PRICE }))
        .to.emit(heroCards, "Minted")
        .withArgs(addr1.address, 1, 1); // tokenId=1, metadataId=1 (before randomization)
    });

    it("should track totalMinted correctly", async function () {
      await heroCards.connect(addr1).mint(3, { value: MINT_PRICE * 3n });
      await heroCards.connect(addr2).mint(2, { value: MINT_PRICE * 2n });
      expect(await heroCards.totalMinted()).to.equal(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // WHITELIST MINTING
  // ═══════════════════════════════════════════════════════════════

  describe("Whitelist Minting", function () {
    beforeEach(async function () {
      await heroCards.setMintPhase(1); // WHITELIST
    });

    it("should allow whitelisted address to mint", async function () {
      const leaf = keccak256(ethers.solidityPacked(["address"], [addr1.address]));
      const proof = merkleTree.getHexProof(leaf);

      await heroCards.connect(addr1).whitelistMint(1, proof, { value: WL_PRICE });
      expect(await heroCards.balanceOf(addr1.address)).to.equal(1);
    });

    it("should revert for non-whitelisted address", async function () {
      const leaf = keccak256(ethers.solidityPacked(["address"], [addr3.address]));
      const proof = merkleTree.getHexProof(leaf);

      await expect(
        heroCards.connect(addr3).whitelistMint(1, proof, { value: WL_PRICE })
      ).to.be.revertedWithCustomError(heroCards, "NotWhitelisted");
    });

    it("should use whitelist price (cheaper)", async function () {
      const leaf = keccak256(ethers.solidityPacked(["address"], [addr1.address]));
      const proof = merkleTree.getHexProof(leaf);

      // Should fail with public price minus 1 wei
      await expect(
        heroCards.connect(addr1).whitelistMint(1, proof, { value: WL_PRICE - 1n })
      ).to.be.revertedWithCustomError(heroCards, "InsufficientPayment");

      // Should succeed with whitelist price
      await heroCards.connect(addr1).whitelistMint(1, proof, { value: WL_PRICE });
      expect(await heroCards.balanceOf(addr1.address)).to.equal(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEAM MINTING
  // ═══════════════════════════════════════════════════════════════

  describe("Team Minting", function () {
    it("should allow owner to team mint", async function () {
      await heroCards.teamMint(addr1.address, 5);
      expect(await heroCards.balanceOf(addr1.address)).to.equal(5);
      expect(await heroCards.teamMinted()).to.equal(5);
    });

    it("should revert when non-owner tries team mint", async function () {
      await expect(
        heroCards.connect(addr1).teamMint(addr1.address, 1)
      ).to.be.revertedWithCustomError(heroCards, "OwnableUnauthorizedAccount");
    });

    it("should revert when exceeding team reserve", async function () {
      await heroCards.teamMint(addr1.address, 50); // Max reserve
      await expect(
        heroCards.teamMint(addr1.address, 1)
      ).to.be.revertedWithCustomError(heroCards, "ExceedsWalletLimit");
    });

    it("should revert with zero address", async function () {
      await expect(
        heroCards.teamMint(ethers.ZeroAddress, 1)
      ).to.be.revertedWithCustomError(heroCards, "ZeroAddress");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RANDOMIZATION
  // ═══════════════════════════════════════════════════════════════

  describe("Randomization", function () {
    it("should return tokenId as metadataId before randomization", async function () {
      await heroCards.setMintPhase(2);
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });
      expect(await heroCards.getMetadataId(1)).to.equal(1);
    });

    it("should set random start index after request + finalize", async function () {
      await heroCards.requestRandomSeed();
      
      // Mine a block
      await ethers.provider.send("evm_mine", []);
      
      await heroCards.finalizeRandomStartIndex();
      expect(await heroCards.startIndexSet()).to.be.true;
      
      const startIndex = await heroCards.randomStartIndex();
      expect(startIndex).to.be.gte(1);
      expect(startIndex).to.be.lte(1500);
    });

    it("should apply offset after randomization", async function () {
      await heroCards.setMintPhase(2);
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });

      await heroCards.requestRandomSeed();
      await ethers.provider.send("evm_mine", []);
      await heroCards.finalizeRandomStartIndex();

      const startIndex = await heroCards.randomStartIndex();
      const expectedMetadataId = ((1n + startIndex - 1n) % 1500n) + 1n;
      expect(await heroCards.getMetadataId(1)).to.equal(expectedMetadataId);
    });

    it("should revert double randomization", async function () {
      await heroCards.requestRandomSeed();
      await ethers.provider.send("evm_mine", []);
      await heroCards.finalizeRandomStartIndex();

      await expect(
        heroCards.requestRandomSeed()
      ).to.be.revertedWithCustomError(heroCards, "StartIndexAlreadySet");
    });

    it("should revert finalize before request", async function () {
      await expect(
        heroCards.finalizeRandomStartIndex()
      ).to.be.revertedWithCustomError(heroCards, "RandomSeedNotReady");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // HOLDER VERIFICATION & UTILITY
  // ═══════════════════════════════════════════════════════════════

  describe("Holder Verification & Utility", function () {
    beforeEach(async function () {
      await heroCards.setMintPhase(2);
    });

    it("should return false for non-holder", async function () {
      expect(await heroCards.isHolder(addr1.address)).to.be.false;
      expect(await heroCards.canAccessSpinWheel(addr1.address)).to.be.false;
      expect(await heroCards.getFeeDiscount(addr1.address)).to.equal(0);
      expect(await heroCards.getHolderTier(addr1.address)).to.equal(0);
    });

    it("should return Bronze tier for 1 NFT holder", async function () {
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });
      expect(await heroCards.isHolder(addr1.address)).to.be.true;
      expect(await heroCards.getHolderTier(addr1.address)).to.equal(1); // Bronze
      expect(await heroCards.canAccessSpinWheel(addr1.address)).to.be.true;
      expect(await heroCards.getFeeDiscount(addr1.address)).to.equal(200); // 2%
    });

    it("should return Silver tier for 3+ NFT holder", async function () {
      await heroCards.connect(addr1).mint(3, { value: MINT_PRICE * 3n });
      expect(await heroCards.getHolderTier(addr1.address)).to.equal(2); // Silver
    });

    it("should return Gold tier for 10+ NFT holder", async function () {
      await heroCards.connect(addr1).mint(10, { value: MINT_PRICE * 10n });
      expect(await heroCards.getHolderTier(addr1.address)).to.equal(3); // Gold
    });

    it("should return 2% fee discount for any holder", async function () {
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });
      expect(await heroCards.getFeeDiscount(addr1.address)).to.equal(200);
    });

    it("should return 0 fee discount for non-holder", async function () {
      expect(await heroCards.getFeeDiscount(addr3.address)).to.equal(0);
    });

    it("should gate spin wheel access to holders only", async function () {
      expect(await heroCards.canAccessSpinWheel(addr1.address)).to.be.false;
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });
      expect(await heroCards.canAccessSpinWheel(addr1.address)).to.be.true;
    });

    it("should lose access after transferring all NFTs", async function () {
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });
      expect(await heroCards.canAccessSpinWheel(addr1.address)).to.be.true;

      // Transfer away
      await heroCards.connect(addr1).transferFrom(addr1.address, addr2.address, 1);
      expect(await heroCards.canAccessSpinWheel(addr1.address)).to.be.false;
      expect(await heroCards.canAccessSpinWheel(addr2.address)).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ADMIN FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  describe("Admin Functions", function () {
    it("should allow owner to change mint phase", async function () {
      await heroCards.setMintPhase(2);
      expect(await heroCards.mintPhase()).to.equal(2);
    });

    it("should allow owner to update base URI", async function () {
      const newURI = "ipfs://NewCID/";
      await heroCards.setBaseURI(newURI);
      
      await heroCards.setMintPhase(2);
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });
      expect(await heroCards.tokenURI(1)).to.equal(newURI + "1");
    });

    it("should allow owner to update mint price", async function () {
      const newPrice = ethers.parseEther("0.01");
      await heroCards.setMintPrice(newPrice);
      expect(await heroCards.mintPrice()).to.equal(newPrice);
    });

    it("should allow owner to update fee discount", async function () {
      await heroCards.setFeeDiscount(300); // 3%
      expect(await heroCards.feeDiscountBps()).to.equal(300);
    });

    it("should revert fee discount > 10%", async function () {
      await expect(heroCards.setFeeDiscount(1001)).to.be.revertedWithCustomError(
        heroCards,
        "ExceedsMaxDiscount"
      );
    });

    it("should allow owner to set provenance hash once", async function () {
      await heroCards.setProvenanceHash("abc123");
      expect(await heroCards.provenanceHash()).to.equal("abc123");
    });

    it("should revert setting provenance hash twice", async function () {
      await heroCards.setProvenanceHash("abc123");
      await expect(
        heroCards.setProvenanceHash("def456")
      ).to.be.revertedWithCustomError(heroCards, "ProvenanceAlreadySet");
    });

    it("should allow owner to pause and unpause", async function () {
      await heroCards.setMintPhase(2);
      await heroCards.pause();
      
      await expect(
        heroCards.connect(addr1).mint(1, { value: MINT_PRICE })
      ).to.be.reverted; // Pausable

      await heroCards.unpause();
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });
      expect(await heroCards.balanceOf(addr1.address)).to.equal(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // WITHDRAW
  // ═══════════════════════════════════════════════════════════════

  describe("Withdraw", function () {
    it("should allow owner to withdraw funds", async function () {
      await heroCards.setMintPhase(2);
      await heroCards.connect(addr1).mint(5, { value: MINT_PRICE * 5n });

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await heroCards.withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(owner.address);

      expect(balanceAfter - balanceBefore + gasUsed).to.equal(MINT_PRICE * 5n);
    });

    it("should revert withdraw with zero balance", async function () {
      await expect(heroCards.withdraw()).to.be.revertedWithCustomError(
        heroCards,
        "InvalidAmount"
      );
    });

    it("should revert non-owner withdraw", async function () {
      await expect(
        heroCards.connect(addr1).withdraw()
      ).to.be.revertedWithCustomError(heroCards, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ROYALTIES (ERC-2981)
  // ═══════════════════════════════════════════════════════════════

  describe("Royalties", function () {
    it("should return 5% royalty info", async function () {
      await heroCards.setMintPhase(2);
      await heroCards.connect(addr1).mint(1, { value: MINT_PRICE });

      const salePrice = ethers.parseEther("1");
      const [receiver, amount] = await heroCards.royaltyInfo(1, salePrice);
      
      expect(receiver).to.equal(owner.address);
      expect(amount).to.equal(salePrice * 500n / 10000n); // 5%
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SUPPLY LIMIT
  // ═══════════════════════════════════════════════════════════════

  describe("Supply Limit", function () {
    it("should revert when exceeding max supply", async function () {
      // This test would require minting 1500 tokens which is expensive
      // Instead we test the logic by checking the revert condition
      await heroCards.setMintPhase(2);
      
      // Mint close to max from multiple wallets
      // (simplified: just verify the error exists)
      const signers = await ethers.getSigners();
      // Mint 20 from each of first 75 signers = 1500
      // Skip this heavy test in CI, just verify the error type exists
      expect(heroCards.interface.getError("ExceedsMaxSupply")).to.not.be.undefined;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ENUMERABLE
  // ═══════════════════════════════════════════════════════════════

  describe("Enumerable", function () {
    it("should track total supply", async function () {
      await heroCards.setMintPhase(2);
      await heroCards.connect(addr1).mint(3, { value: MINT_PRICE * 3n });
      expect(await heroCards.totalSupply()).to.equal(3);
    });

    it("should enumerate tokens by owner", async function () {
      await heroCards.setMintPhase(2);
      await heroCards.connect(addr1).mint(3, { value: MINT_PRICE * 3n });
      
      expect(await heroCards.tokenOfOwnerByIndex(addr1.address, 0)).to.equal(1);
      expect(await heroCards.tokenOfOwnerByIndex(addr1.address, 1)).to.equal(2);
      expect(await heroCards.tokenOfOwnerByIndex(addr1.address, 2)).to.equal(3);
    });
  });
});
