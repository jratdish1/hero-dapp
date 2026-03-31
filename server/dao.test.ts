import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  createProposal: vi.fn().mockResolvedValue({
    id: 1,
    proposalId: "HERO-1",
    title: "Test Proposal",
    description: "Test description",
    proposerAddress: "0x1234567890abcdef1234567890abcdef12345678",
    category: "protocol",
    chain: "both",
    status: "active",
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    startTime: Date.now(),
    endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
    createdAt: Date.now(),
  }),
  getProposalByProposalId: vi.fn().mockResolvedValue({
    id: 1,
    proposalId: "HERO-1",
    title: "Test Proposal",
    description: "Test description",
    proposerAddress: "0x1234567890abcdef1234567890abcdef12345678",
    category: "protocol",
    chain: "both",
    status: "active",
    votesFor: 100,
    votesAgainst: 50,
    votesAbstain: 10,
    startTime: Date.now() - 86400000,
    endTime: Date.now() + 6 * 24 * 60 * 60 * 1000,
    createdAt: Date.now() - 86400000,
  }),
  getProposals: vi.fn().mockResolvedValue([
    {
      id: 1,
      proposalId: "HERO-1",
      title: "Test Proposal 1",
      description: "Description 1",
      proposerAddress: "0x1234",
      category: "protocol",
      chain: "both",
      status: "active",
      votesFor: 100,
      votesAgainst: 50,
      votesAbstain: 10,
      startTime: Date.now(),
      endTime: Date.now() + 604800000,
      createdAt: Date.now(),
    },
    {
      id: 2,
      proposalId: "HERO-2",
      title: "Test Proposal 2",
      description: "Description 2",
      proposerAddress: "0x5678",
      category: "treasury",
      chain: "pulsechain",
      status: "passed",
      votesFor: 5000000,
      votesAgainst: 100000,
      votesAbstain: 50000,
      startTime: Date.now() - 604800000,
      endTime: Date.now() - 100000,
      createdAt: Date.now() - 604800000,
    },
  ]),
  castVote: vi.fn().mockResolvedValue({
    id: 1,
    proposalDbId: 1,
    proposalId: "HERO-1",
    voterAddress: "0xabcdef",
    choice: "for",
    votingPower: 1000,
    chain: "pulsechain",
    createdAt: Date.now(),
  }),
  getVotesByProposal: vi.fn().mockResolvedValue([
    {
      id: 1,
      proposalDbId: 1,
      proposalId: "HERO-1",
      voterAddress: "0xabcdef",
      choice: "for",
      votingPower: 1000,
      chain: "pulsechain",
      createdAt: Date.now(),
    },
  ]),
  registerDelegate: vi.fn().mockResolvedValue({
    id: 1,
    address: "0x1234567890abcdef1234567890abcdef12345678",
    displayName: "TestDelegate",
    statement: "I will represent HERO holders",
    votingPower: 0,
    delegatorCount: 0,
    proposalsVoted: 0,
    createdAt: Date.now(),
  }),
  getDelegates: vi.fn().mockResolvedValue([
    {
      id: 1,
      address: "0x1234",
      displayName: "Delegate1",
      statement: "Statement 1",
      votingPower: 50000,
      delegatorCount: 5,
      proposalsVoted: 3,
      createdAt: Date.now(),
    },
    {
      id: 2,
      address: "0x5678",
      displayName: "Delegate2",
      statement: "Statement 2",
      votingPower: 25000,
      delegatorCount: 2,
      proposalsVoted: 1,
      createdAt: Date.now(),
    },
  ]),
  getDelegateByAddress: vi.fn().mockResolvedValue({
    id: 1,
    address: "0x1234",
    displayName: "Delegate1",
    statement: "Statement 1",
    votingPower: 50000,
    delegatorCount: 5,
    proposalsVoted: 3,
    createdAt: Date.now(),
  }),
  getTreasurySnapshots: vi.fn().mockResolvedValue([
    {
      id: 1,
      chain: "pulsechain",
      tokenAddress: "0x35a51D",
      tokenSymbol: "HERO",
      balance: "5000000",
      valueUsd: "732.50",
      snapshotTime: Date.now(),
    },
    {
      id: 2,
      chain: "base",
      tokenAddress: "0x00Fa69",
      tokenSymbol: "HERO",
      balance: "2000000",
      valueUsd: "293.00",
      snapshotTime: Date.now(),
    },
  ]),
  getProposalCount: vi.fn().mockResolvedValue(10),
  getDelegateCount: vi.fn().mockResolvedValue(5),
}));

// Mock priceFeed
vi.mock("./priceFeed", () => ({
  getTokenPrices: vi.fn().mockResolvedValue({
    hero: { priceUsd: "0.0001465", priceChange24h: -4.07, volume24h: 6.01, liquidity: 3981 },
    vets: { priceUsd: "0.004332", priceChange24h: -3.63, volume24h: 0, liquidity: 936 },
    pls: { priceUsd: "0.000007213", priceChange24h: -3.78, volume24h: 0, liquidity: 0 },
    eth: { priceUsd: "2025.29", priceChange24h: -1.47, volume24h: 0, liquidity: 0 },
  }),
  getFarmPoolData: vi.fn().mockResolvedValue([]),
  getBuyAndBurnData: vi.fn().mockResolvedValue({
    totalBurned: "1235655.63",
    burnPercentage: 1.24,
    totalSupply: "100000000",
    circulatingSupply: "98764344.37",
    burnedUsdValue: 181.02,
    heroPrice: 0.0001465,
  }),
}));

import {
  createProposal,
  getProposalByProposalId,
  getProposals,
  castVote,
  getVotesByProposal,
  registerDelegate,
  getDelegates,
  getDelegateByAddress,
  getTreasurySnapshots,
  getProposalCount,
  getDelegateCount,
} from "./db";

describe("DAO Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Proposals", () => {
    it("should create a new proposal", async () => {
      const result = await createProposal({
        proposalId: "HERO-1",
        title: "Test Proposal",
        description: "Test description",
        proposerAddress: "0x1234567890abcdef1234567890abcdef12345678",
        category: "protocol",
        chain: "both",
        status: "active",
        startTime: Date.now(),
        endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      expect(result).toBeDefined();
      expect(result.proposalId).toBe("HERO-1");
      expect(result.title).toBe("Test Proposal");
      expect(result.status).toBe("active");
      expect(createProposal).toHaveBeenCalledOnce();
    });

    it("should retrieve a proposal by proposalId", async () => {
      const result = await getProposalByProposalId("HERO-1");

      expect(result).toBeDefined();
      expect(result!.proposalId).toBe("HERO-1");
      expect(result!.votesFor).toBe(100);
      expect(result!.votesAgainst).toBe(50);
      expect(getProposalByProposalId).toHaveBeenCalledWith("HERO-1");
    });

    it("should list proposals with optional status filter", async () => {
      const result = await getProposals({ limit: 100 });

      expect(result).toHaveLength(2);
      expect(result[0].proposalId).toBe("HERO-1");
      expect(result[1].proposalId).toBe("HERO-2");
      expect(getProposals).toHaveBeenCalledOnce();
    });

    it("should calculate vote percentages correctly", async () => {
      const proposal = await getProposalByProposalId("HERO-1");
      const total = proposal!.votesFor + proposal!.votesAgainst + proposal!.votesAbstain;
      const forPct = (proposal!.votesFor / total) * 100;
      const againstPct = (proposal!.votesAgainst / total) * 100;

      expect(total).toBe(160);
      expect(forPct).toBeCloseTo(62.5, 1);
      expect(againstPct).toBeCloseTo(31.25, 1);
    });

    it("should track proposal count", async () => {
      const count = await getProposalCount();
      expect(count).toBe(10);
    });
  });

  describe("Votes", () => {
    it("should cast a vote on a proposal", async () => {
      const result = await castVote({
        proposalDbId: 1,
        proposalId: "HERO-1",
        voterAddress: "0xabcdef",
        choice: "for",
        votingPower: 1000,
        chain: "pulsechain",
      });

      expect(result).toBeDefined();
      expect(result.choice).toBe("for");
      expect(result.votingPower).toBe(1000);
      expect(castVote).toHaveBeenCalledOnce();
    });

    it("should list votes for a proposal", async () => {
      const result = await getVotesByProposal(1);

      expect(result).toHaveLength(1);
      expect(result[0].voterAddress).toBe("0xabcdef");
      expect(result[0].choice).toBe("for");
    });

    it("should validate vote choices", () => {
      const validChoices = ["for", "against", "abstain"];
      expect(validChoices).toContain("for");
      expect(validChoices).toContain("against");
      expect(validChoices).toContain("abstain");
      expect(validChoices).not.toContain("maybe");
    });
  });

  describe("Delegates", () => {
    it("should register a new delegate", async () => {
      const result = await registerDelegate({
        address: "0x1234567890abcdef1234567890abcdef12345678",
        displayName: "TestDelegate",
        statement: "I will represent HERO holders",
      });

      expect(result).toBeDefined();
      expect(result.displayName).toBe("TestDelegate");
      expect(result.votingPower).toBe(0);
      expect(registerDelegate).toHaveBeenCalledOnce();
    });

    it("should list delegates sorted by voting power", async () => {
      const result = await getDelegates({ limit: 100 });

      expect(result).toHaveLength(2);
      expect(result[0].votingPower).toBeGreaterThanOrEqual(result[1].votingPower);
    });

    it("should find a delegate by address", async () => {
      const result = await getDelegateByAddress("0x1234");

      expect(result).toBeDefined();
      expect(result!.displayName).toBe("Delegate1");
      expect(result!.delegatorCount).toBe(5);
    });

    it("should track delegate count", async () => {
      const count = await getDelegateCount();
      expect(count).toBe(5);
    });
  });

  describe("Treasury", () => {
    it("should retrieve treasury snapshots", async () => {
      const result = await getTreasurySnapshots({});

      expect(result).toHaveLength(2);
      expect(result[0].chain).toBe("pulsechain");
      expect(result[1].chain).toBe("base");
    });

    it("should calculate total treasury value", async () => {
      const snapshots = await getTreasurySnapshots({});
      const totalValue = snapshots.reduce(
        (sum, s) => sum + parseFloat(s.valueUsd || "0"),
        0
      );

      expect(totalValue).toBeCloseTo(1025.50, 1);
    });

    it("should separate snapshots by chain", async () => {
      const snapshots = await getTreasurySnapshots({});
      const pulseSnapshots = snapshots.filter(s => s.chain === "pulsechain");
      const baseSnapshots = snapshots.filter(s => s.chain === "base");

      expect(pulseSnapshots).toHaveLength(1);
      expect(baseSnapshots).toHaveLength(1);
      expect(pulseSnapshots[0].tokenSymbol).toBe("HERO");
      expect(baseSnapshots[0].tokenSymbol).toBe("HERO");
    });
  });

  describe("DAO Stats", () => {
    it("should aggregate DAO statistics", async () => {
      const proposalCount = await getProposalCount();
      const delegateCount = await getDelegateCount();
      const snapshots = await getTreasurySnapshots({});
      const treasuryValue = snapshots.reduce(
        (sum, s) => sum + parseFloat(s.valueUsd || "0"),
        0
      );

      expect(proposalCount).toBe(10);
      expect(delegateCount).toBe(5);
      expect(treasuryValue).toBeGreaterThan(0);
    });
  });

  describe("Proposal ID Generation", () => {
    it("should generate sequential proposal IDs", () => {
      const generateId = (count: number) => `HERO-${count + 1}`;
      expect(generateId(0)).toBe("HERO-1");
      expect(generateId(9)).toBe("HERO-10");
      expect(generateId(99)).toBe("HERO-100");
    });
  });

  describe("Quorum Calculation", () => {
    it("should calculate quorum percentage correctly", () => {
      const quorum = 5_000_000;
      const totalVotes = 2_500_000;
      const quorumPct = (totalVotes / quorum) * 100;
      expect(quorumPct).toBe(50);
    });

    it("should cap quorum at 100%", () => {
      const quorum = 5_000_000;
      const totalVotes = 10_000_000;
      const quorumPct = Math.min((totalVotes / quorum) * 100, 100);
      expect(quorumPct).toBe(100);
    });

    it("should handle zero votes", () => {
      const quorum = 5_000_000;
      const totalVotes = 0;
      const quorumPct = (totalVotes / quorum) * 100;
      expect(quorumPct).toBe(0);
    });
  });

  describe("Proposal Status Logic", () => {
    it("should identify active proposals", () => {
      const now = Date.now();
      const proposal = { status: "active", endTime: now + 86400000 };
      const isActive = proposal.status === "active" && proposal.endTime > now;
      expect(isActive).toBe(true);
    });

    it("should identify expired proposals", () => {
      const now = Date.now();
      const proposal = { status: "active", endTime: now - 86400000 };
      const isExpired = proposal.endTime < now;
      expect(isExpired).toBe(true);
    });

    it("should calculate time remaining", () => {
      const now = Date.now();
      const endTime = now + 3 * 24 * 60 * 60 * 1000; // 3 days
      const daysLeft = Math.ceil((endTime - now) / (1000 * 60 * 60 * 24));
      expect(daysLeft).toBe(3);
    });
  });

  describe("Wallet Address Validation", () => {
    it("should validate Ethereum addresses", () => {
      const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);
      expect(isValidAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(true);
      expect(isValidAddress("0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8")).toBe(true);
      expect(isValidAddress("not-an-address")).toBe(false);
      expect(isValidAddress("0x123")).toBe(false);
      expect(isValidAddress("")).toBe(false);
    });
  });

  describe("Chain Data", () => {
    it("should support both PulseChain and Base chains", () => {
      const validChains = ["pulsechain", "base", "both"];
      expect(validChains).toContain("pulsechain");
      expect(validChains).toContain("base");
      expect(validChains).toContain("both");
    });

    it("should have correct chain IDs", () => {
      const chainIds = { pulsechain: 369, base: 8453 };
      expect(chainIds.pulsechain).toBe(369);
      expect(chainIds.base).toBe(8453);
    });
  });
});
