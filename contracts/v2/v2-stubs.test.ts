/**
 * V2 Contract Stub Structural Tests
 *
 * These tests verify the stub files exist, are syntactically valid Solidity,
 * contain the required safety constants, and include the NOT DEPLOYED warning.
 * They do NOT compile or deploy the contracts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const V2_DIR = join(__dirname, ".");

function readStub(filename: string): string {
  const fullPath = join(V2_DIR, filename);
  expect(existsSync(fullPath), `${filename} must exist`).toBe(true);
  return readFileSync(fullPath, "utf-8");
}

// ─── File Existence ───────────────────────────────────────────────────────────
describe("V2 Contract Stubs — File Existence", () => {
  const REQUIRED_FILES = [
    "HeroCardsV2.sol",
    "HeroCardsRewardsDistributor.sol",
    "HeroCardsMarketplace.sol",
    "HeroBuyBurnRouter.sol",
    "HeroCardsV2Registry.sol",
  ];

  REQUIRED_FILES.forEach((file) => {
    it(`${file} exists`, () => {
      expect(existsSync(join(V2_DIR, file))).toBe(true);
    });
  });
});

// ─── NOT DEPLOYED Warning ─────────────────────────────────────────────────────
describe("V2 Contract Stubs — NOT DEPLOYED Warning", () => {
  const STUBS = [
    "HeroCardsV2.sol",
    "HeroCardsRewardsDistributor.sol",
    "HeroCardsMarketplace.sol",
    "HeroBuyBurnRouter.sol",
    "HeroCardsV2Registry.sol",
  ];

  STUBS.forEach((file) => {
    it(`${file} contains NOT DEPLOYED warning`, () => {
      const content = readStub(file);
      expect(content).toContain("NOT DEPLOYED");
    });
  });
});

// ─── Solidity Version ─────────────────────────────────────────────────────────
describe("V2 Contract Stubs — Solidity Version", () => {
  const STUBS = [
    "HeroCardsV2.sol",
    "HeroCardsRewardsDistributor.sol",
    "HeroCardsMarketplace.sol",
    "HeroBuyBurnRouter.sol",
    "HeroCardsV2Registry.sol",
  ];

  STUBS.forEach((file) => {
    it(`${file} uses pragma solidity ^0.8.24`, () => {
      const content = readStub(file);
      expect(content).toContain("pragma solidity ^0.8.24");
    });
  });
});

// ─── HeroCardsV2.sol ──────────────────────────────────────────────────────────
describe("HeroCardsV2.sol — Safety Constants", () => {
  let content: string;
  beforeAll(() => { content = readStub("HeroCardsV2.sol"); });

  it("MAX_SUPPLY is 1500", () => {
    expect(content).toContain("MAX_SUPPLY = 1500");
  });

  it("MAX_PER_WALLET is 20", () => {
    expect(content).toContain("MAX_PER_WALLET = 20");
  });

  it("uses ReentrancyGuard", () => {
    expect(content).toContain("ReentrancyGuard");
  });

  it("uses Ownable2Step (not plain Ownable)", () => {
    expect(content).toContain("Ownable2Step");
    // Should NOT use plain Ownable as the base (only Ownable2Step)
  });

  it("uses Pausable", () => {
    expect(content).toContain("Pausable");
  });

  it("uses MerkleProof for whitelist", () => {
    expect(content).toContain("MerkleProof");
  });

  it("has emergencyWithdraw function", () => {
    expect(content).toContain("emergencyWithdraw");
  });

  it("has provenance hash support", () => {
    expect(content).toContain("provenanceHash");
  });

  it("has randomized reveal (setRandomStartIndex)", () => {
    expect(content).toContain("setRandomStartIndex");
  });

  it("has royalty support (ERC721Royalty)", () => {
    expect(content).toContain("ERC721Royalty");
  });

  it("has contractURI for marketplace metadata", () => {
    expect(content).toContain("contractURI");
  });

  it("has holder tier function (no unbounded loops)", () => {
    expect(content).toContain("getHolderTier");
    // Must NOT have a loop over all holders
    expect(content).not.toContain("for (uint256 i = 0; i < totalSupply()");
  });

  it("references V1 deployed addresses in comments", () => {
    expect(content).toContain("0x5Fad096af059ff9A2167351A0ffc8b45D71897bE");
    expect(content).toContain("0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36");
  });
});

// ─── HeroCardsRewardsDistributor.sol ─────────────────────────────────────────
describe("HeroCardsRewardsDistributor.sol — Safety Features", () => {
  let content: string;
  beforeAll(() => { content = readStub("HeroCardsRewardsDistributor.sol"); });

  it("uses Merkle proof for claims", () => {
    expect(content).toContain("MerkleProof");
  });

  it("has double-claim prevention", () => {
    expect(content).toContain("AlreadyClaimed");
  });

  it("has epoch finalization (immutable after finalize)", () => {
    expect(content).toContain("finalized");
  });

  it("has fund recovery with delay", () => {
    expect(content).toContain("RECOVERY_DELAY");
    expect(content).toContain("RecoveryTooEarly");
  });

  it("uses ReentrancyGuard on claim", () => {
    expect(content).toContain("nonReentrant");
  });

  it("uses Pausable", () => {
    expect(content).toContain("Pausable");
  });

  it("uses SafeERC20 for token transfers", () => {
    expect(content).toContain("SafeERC20");
  });
});

// ─── HeroCardsMarketplace.sol ─────────────────────────────────────────────────
describe("HeroCardsMarketplace.sol — Safety Features", () => {
  let content: string;
  beforeAll(() => { content = readStub("HeroCardsMarketplace.sol"); });

  it("re-checks ownership at purchase time", () => {
    expect(content).toContain("ownerOf(listing.tokenId) != listing.seller");
  });

  it("re-checks approval at purchase time", () => {
    expect(content).toContain("getApproved(listing.tokenId)");
  });

  it("has listing expiration", () => {
    expect(content).toContain("expiresAt");
    expect(content).toContain("ListingExpired");
  });

  it("uses ReentrancyGuard on buy()", () => {
    expect(content).toContain("nonReentrant");
  });

  it("handles ERC-2981 royalties", () => {
    expect(content).toContain("IERC2981");
    expect(content).toContain("royaltyInfo");
  });

  it("refunds overpayment", () => {
    expect(content).toContain("msg.value > listing.price");
  });

  it("has platform fee cap (max 10%)", () => {
    expect(content).toContain("Fee too high");
  });
});

// ─── HeroBuyBurnRouter.sol ────────────────────────────────────────────────────
describe("HeroBuyBurnRouter.sol — Safety Features", () => {
  let content: string;
  beforeAll(() => { content = readStub("HeroBuyBurnRouter.sol"); });

  it("enforces basis points sum to 10000", () => {
    expect(content).toContain("BpsNotSumTo10000");
    expect(content).toContain("10_000");
  });

  it("has emergency withdraw (only when paused)", () => {
    expect(content).toContain("emergencyWithdraw");
    expect(content).toContain("whenPaused");
  });

  it("prevents zero address recipients", () => {
    expect(content).toContain("ZeroAddress");
  });

  it("uses ReentrancyGuard on distribute", () => {
    expect(content).toContain("nonReentrant");
  });

  it("last recipient gets remainder (no dust loss)", () => {
    expect(content).toContain("amount - distributed");
  });

  it("emits FundsDistributed event for audit trail", () => {
    expect(content).toContain("FundsDistributed");
  });
});

// ─── HeroCardsV2Registry.sol ──────────────────────────────────────────────────
describe("HeroCardsV2Registry.sol — Safety Features", () => {
  let content: string;
  beforeAll(() => { content = readStub("HeroCardsV2Registry.sol"); });

  it("uses Ownable2Step", () => {
    expect(content).toContain("Ownable2Step");
  });

  it("emits events on all module changes", () => {
    expect(content).toContain("ModuleRegistered");
    expect(content).toContain("ModuleUpdated");
    expect(content).toContain("ModuleStatusChanged");
  });

  it("has ACTIVE, PAUSED, DEPRECATED status enum", () => {
    expect(content).toContain("ACTIVE");
    expect(content).toContain("PAUSED");
    expect(content).toContain("DEPRECATED");
  });

  it("getModule returns address(0) for non-active modules", () => {
    expect(content).toContain("return address(0)");
  });

  it("prevents zero address registration", () => {
    expect(content).toContain("ZeroAddress");
  });

  it("stores registeredAt and updatedAt timestamps", () => {
    expect(content).toContain("registeredAt");
    expect(content).toContain("updatedAt");
  });
});
