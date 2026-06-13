/**
 * OSINT Router Tests — Flowsint integration
 * Tests the wallet investigation and contract monitoring tRPC procedures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock env
process.env.FLOWSINT_URL = "http://localhost:3001";
process.env.APP_URL = "http://localhost:3000";
process.env.NODE_ENV = "test";

// Import after env is set
const { osintRouter } = await import("./routers/osint");

describe("OSINT Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("investigateWallet input validation", () => {
    it("should reject invalid EVM address", async () => {
      const caller = osintRouter.createCaller({
        user: { id: 1, walletAddress: "0x123" } as any,
        req: {} as any,
        res: {} as any,
      });

      await expect(
        caller.investigateWallet({ address: "not-an-address", depth: 1, chain: "pulsechain" })
      ).rejects.toThrow();
    });

    it("should normalize address to lowercase", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nodes: [],
          edges: [],
          riskScore: 0.1,
        }),
      });

      const caller = osintRouter.createCaller({
        user: { id: 1, walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12" } as any,
        req: {} as any,
        res: {} as any,
      });

      await caller.investigateWallet({
        address: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        depth: 1,
        chain: "pulsechain",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.address).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    });

    it("should reject depth > 3", async () => {
      const caller = osintRouter.createCaller({
        user: { id: 1 } as any,
        req: {} as any,
        res: {} as any,
      });

      await expect(
        caller.investigateWallet({
          address: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
          depth: 5,
          chain: "pulsechain",
        })
      ).rejects.toThrow();
    });
  });

  describe("investigateWallet service calls", () => {
    it("should return graph data on success", async () => {
      const mockGraph = {
        nodes: [{ id: "1", type: "wallet", label: "Test Wallet", metadata: {} }],
        edges: [],
        riskScore: 0.2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGraph,
      });

      const caller = osintRouter.createCaller({
        user: { id: 1 } as any,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.investigateWallet({
        address: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        depth: 2,
        chain: "pulsechain",
      });

      expect(result.riskScore).toBe(0.2);
      expect(result.nodes).toHaveLength(1);
    });

    it("should throw on OSINT service error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "Service unavailable",
      });

      const caller = osintRouter.createCaller({
        user: { id: 1 } as any,
        req: {} as any,
        res: {} as any,
      });

      await expect(
        caller.investigateWallet({
          address: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
          depth: 1,
          chain: "base",
        })
      ).rejects.toThrow("OSINT service error: 503");
    });
  });

  describe("monitorContract", () => {
    it("should register a contract monitor", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "monitor-abc123" }),
      });

      const caller = osintRouter.createCaller({
        user: { id: 42 } as any,
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.monitorContract({
        contractAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
        chain: "pulsechain",
        alertThreshold: 0.8,
      });

      expect(result.success).toBe(true);
      expect(result.monitorId).toBe("monitor-abc123");
    });

    it("should reject alertThreshold > 1", async () => {
      const caller = osintRouter.createCaller({
        user: { id: 1 } as any,
        req: {} as any,
        res: {} as any,
      });

      await expect(
        caller.monitorContract({
          contractAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
          chain: "base",
          alertThreshold: 1.5,
        })
      ).rejects.toThrow();
    });
  });
});
