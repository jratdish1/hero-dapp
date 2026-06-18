/**
 * HeroCardsRewardsDistributor.test.mjs
 * Unit tests for HeroCardsRewardsDistributor.sol
 *
 * Date: 2026-06-18 17:45 PDT
 * Scope: Local compile and unit tests only.
 *        No live deployment. No testnet/mainnet transactions.
 *        No private keys.
 *
 * Merkle tree note:
 *   The contract uses keccak256(abi.encodePacked(addr, nativeAmount, tokenAmount))
 *   as the leaf hash — a single keccak256 of packed encoding.
 *   StandardMerkleTree from @openzeppelin/merkle-tree uses ABI encoding + double
 *   keccak256, which is INCOMPATIBLE. This file uses a custom buildMerkleTree()
 *   helper that matches the contract's leaf encoding exactly.
 */

import { expect } from "chai";
import hre from "hardhat";

// ─── Custom Merkle tree helpers ────────────────────────────────────────────────
// Matches the contract: leaf = keccak256(abi.encodePacked(addr, native, token))
// Node pairing: commutativeKeccak256 = keccak256(sort(a,b))
// This matches OpenZeppelin's MerkleProof.sol processProof() behavior.

function leafHash(ethers, addr, native, token) {
  return ethers.keccak256(
    ethers.solidityPacked(["address", "uint256", "uint256"], [addr, native, token])
  );
}

function commutativeKeccak256(ethers, a, b) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return ethers.keccak256(ethers.concat([lo, hi]));
}

/**
 * Build a simple binary Merkle tree from an array of leaf entries.
 * Each entry is [addr, nativeAmt, tokenAmt].
 * Returns { root, getProof(entry) }.
 */
function buildMerkleTree(ethers, entries) {
  const leaves = entries.map(([addr, native, token]) =>
    leafHash(ethers, addr, native, token)
  );

  if (leaves.length === 0) throw new Error("Empty leaves");
  if (leaves.length === 1) {
    return { root: leaves[0], getProof: (_entry) => [] };
  }

  // Build tree layer by layer (bottom-up)
  const layers = [leaves.slice()];
  let current = leaves.slice();

  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(commutativeKeccak256(ethers, current[i], current[i + 1]));
      } else {
        next.push(current[i]); // odd leaf: promote as-is
      }
    }
    layers.push(next);
    current = next;
  }

  const root = current[0];

  function getProof(entry) {
    const [addr, native, token] = entry;
    const targetLeaf = leafHash(ethers, addr, native, token);
    let idx = layers[0].indexOf(targetLeaf);
    if (idx === -1) throw new Error("Leaf not found in tree");

    const proof = [];
    for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
      const layer = layers[layerIdx];
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (siblingIdx < layer.length) {
        proof.push(layer[siblingIdx]);
      }
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  return { root, getProof };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("HeroCardsRewardsDistributor", function () {
  let distributor, mockToken, ethers;
  let owner, addr1, addr2, addr3;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20ForTesting");
    mockToken = await MockERC20.deploy("HERO Token", "HERO", ethers.parseEther("1000000"));
    await mockToken.waitForDeployment();

    const Distributor = await ethers.getContractFactory("HeroCardsRewardsDistributor");
    distributor = await Distributor.deploy(await mockToken.getAddress());
    await distributor.waitForDeployment();

    await mockToken.approve(await distributor.getAddress(), ethers.parseEther("10000"));
  });

  // ─── Deployment ────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set the hero token correctly", async function () {
      expect(await distributor.heroToken()).to.equal(await mockToken.getAddress());
    });

    it("should set owner correctly", async function () {
      expect(await distributor.owner()).to.equal(owner.address);
    });

    it("should start with 0 epochs", async function () {
      expect(await distributor.epochCount()).to.equal(0n);
    });
  });

  // ─── Epoch Management ──────────────────────────────────────────────────────
  describe("Epoch Management", function () {
    it("should revert createEpoch if not owner", async function () {
      await expect(
        distributor.connect(addr1).createEpoch(ethers.ZeroHash, 0n, 86400n, { value: 0n })
      ).to.be.revertedWithCustomError(distributor, "OwnableUnauthorizedAccount");
    });

    it("should create an epoch and increment epochCount", async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await distributor.createEpoch(root, 0n, 86400n, { value: ethers.parseEther("1") });
      expect(await distributor.epochCount()).to.equal(1n);
    });

    it("should emit EpochCreated on createEpoch", async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await expect(
        distributor.createEpoch(root, 0n, 86400n, { value: ethers.parseEther("1") })
      ).to.emit(distributor, "EpochCreated").withArgs(1n, root, ethers.parseEther("1"), 0n);
    });

    it("should allow owner to finalize an epoch", async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await distributor.createEpoch(root, 0n, 86400n, { value: ethers.parseEther("1") });
      await expect(distributor.finalizeEpoch(1n))
        .to.emit(distributor, "EpochFinalized").withArgs(1n);
    });

    it("should revert double-finalize with EpochAlreadyFinalized", async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await distributor.createEpoch(root, 0n, 86400n, { value: ethers.parseEther("1") });
      await distributor.finalizeEpoch(1n);
      await expect(
        distributor.finalizeEpoch(1n)
      ).to.be.revertedWithCustomError(distributor, "EpochAlreadyFinalized");
    });

    it("should revert finalizeEpoch if not owner", async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes("test-root"));
      await distributor.createEpoch(root, 0n, 86400n, { value: ethers.parseEther("1") });
      await expect(
        distributor.connect(addr1).finalizeEpoch(1n)
      ).to.be.revertedWithCustomError(distributor, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Claim ─────────────────────────────────────────────────────────────────
  describe("Claim", function () {
    let tree, epochId, nativeAmt, tokenAmt;

    beforeEach(async function () {
      nativeAmt = ethers.parseEther("0.1");
      tokenAmt = ethers.parseEther("100");

      // Build a custom Merkle tree matching the contract's leaf encoding:
      // leaf = keccak256(abi.encodePacked(addr, nativeAmt, tokenAmt))
      tree = buildMerkleTree(ethers, [
        [addr1.address, nativeAmt, tokenAmt],
        [addr2.address, ethers.parseEther("0.05"), ethers.parseEther("50")],
      ]);

      await mockToken.approve(await distributor.getAddress(), tokenAmt * 2n);

      await distributor.createEpoch(
        tree.root,
        tokenAmt * 2n,
        86400n,
        { value: nativeAmt * 2n }
      );
      epochId = 1n;
      await distributor.finalizeEpoch(epochId);
    });

    it("should allow a valid claim with correct Merkle proof", async function () {
      const proof = tree.getProof([addr1.address, nativeAmt, tokenAmt]);
      const balanceBefore = await ethers.provider.getBalance(addr1.address);
      const tx = await distributor.connect(addr1).claim(epochId, nativeAmt, tokenAmt, proof);
      await tx.wait();
      const balanceAfter = await ethers.provider.getBalance(addr1.address);
      expect(balanceAfter).to.be.gt(balanceBefore - ethers.parseEther("0.01"));
      expect(await mockToken.balanceOf(addr1.address)).to.equal(tokenAmt);
    });

    it("should emit Claimed event on successful claim", async function () {
      const proof = tree.getProof([addr1.address, nativeAmt, tokenAmt]);
      await expect(
        distributor.connect(addr1).claim(epochId, nativeAmt, tokenAmt, proof)
      ).to.emit(distributor, "Claimed").withArgs(epochId, addr1.address, nativeAmt, tokenAmt);
    });

    it("should revert double-claim with AlreadyClaimed", async function () {
      const proof = tree.getProof([addr1.address, nativeAmt, tokenAmt]);
      await distributor.connect(addr1).claim(epochId, nativeAmt, tokenAmt, proof);
      await expect(
        distributor.connect(addr1).claim(epochId, nativeAmt, tokenAmt, proof)
      ).to.be.revertedWithCustomError(distributor, "AlreadyClaimed");
    });

    it("should revert claim with invalid proof", async function () {
      const badProof = [ethers.keccak256(ethers.toUtf8Bytes("bad"))];
      await expect(
        distributor.connect(addr1).claim(epochId, nativeAmt, tokenAmt, badProof)
      ).to.be.revertedWithCustomError(distributor, "InvalidProof");
    });

    it("should revert claim after epoch expires", async function () {
      // Use ethers.provider.send — same provider as contract interactions (not a new conn)
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);
      const proof = tree.getProof([addr1.address, nativeAmt, tokenAmt]);
      await expect(
        distributor.connect(addr1).claim(epochId, nativeAmt, tokenAmt, proof)
      ).to.be.revertedWithCustomError(distributor, "EpochNotActive");
    });
  });

  // ─── Pause / Unpause ───────────────────────────────────────────────────────
  describe("Pause / Unpause", function () {
    it("should allow owner to pause", async function () {
      await distributor.pause();
      expect(await distributor.paused()).to.equal(true);
    });

    it("should revert pause if not owner", async function () {
      await expect(
        distributor.connect(addr1).pause()
      ).to.be.revertedWithCustomError(distributor, "OwnableUnauthorizedAccount");
    });
  });
});
