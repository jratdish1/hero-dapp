import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { appRouter } from "./routers";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getProposalById: vi.fn(),
    updateProposal: vi.fn().mockResolvedValue(undefined),
    getDelegateByAddress: vi.fn(),
    updateDelegate: vi.fn().mockResolvedValue(undefined),
  };
});

function createAuthenticatedContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `dao-owner-test-${userId}`,
      email: `dao-owner-${userId}@test.invalid`,
      name: `DAO Owner ${userId}`,
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

const delegateAddress = "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27";

describe("DAO ownership authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects proposal status changes from a different authenticated user", async () => {
    vi.mocked(db.getProposalById).mockResolvedValue({
      id: 41,
      proposalId: "proposal-41",
      proposerId: 200,
    } as Awaited<ReturnType<typeof db.getProposalById>>);

    const caller = appRouter.createCaller(createAuthenticatedContext(100));

    await expect(
      caller.dao.proposals.updateStatus({
        proposalId: "proposal-41",
        status: "active",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.updateProposal).not.toHaveBeenCalled();
  });

  it("allows the stored proposal creator to update proposal status", async () => {
    vi.mocked(db.getProposalById).mockResolvedValue({
      id: 42,
      proposalId: "proposal-42",
      proposerId: 100,
    } as Awaited<ReturnType<typeof db.getProposalById>>);

    const caller = appRouter.createCaller(createAuthenticatedContext(100));
    await expect(
      caller.dao.proposals.updateStatus({
        proposalId: "proposal-42",
        status: "active",
      }),
    ).resolves.toEqual({ success: true });
    expect(db.updateProposal).toHaveBeenCalledTimes(1);
    expect(db.updateProposal).toHaveBeenCalledWith(42, { status: "active" });
  });

  it("rejects delegate profile changes from a different authenticated user", async () => {
    vi.mocked(db.getDelegateByAddress).mockResolvedValue({
      id: 51,
      userId: 200,
      address: delegateAddress,
      displayName: "Original delegate",
      statement: "Original statement",
    } as Awaited<ReturnType<typeof db.getDelegateByAddress>>);

    const caller = appRouter.createCaller(createAuthenticatedContext(100));

    await expect(
      caller.dao.delegates.update({
        address: delegateAddress,
        displayName: "Unauthorized change",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.updateDelegate).not.toHaveBeenCalled();
  });

  it("allows the stored delegate owner to update the delegate profile", async () => {
    vi.mocked(db.getDelegateByAddress).mockResolvedValue({
      id: 52,
      userId: 100,
      address: delegateAddress,
      displayName: "Original delegate",
      statement: "Original statement",
    } as Awaited<ReturnType<typeof db.getDelegateByAddress>>);

    const caller = appRouter.createCaller(createAuthenticatedContext(100));
    await expect(
      caller.dao.delegates.update({
        address: delegateAddress,
        displayName: "Updated delegate",
      }),
    ).resolves.toEqual({ success: true });
    expect(db.updateDelegate).toHaveBeenCalledTimes(1);
    expect(db.updateDelegate).toHaveBeenCalledWith(52, {
      displayName: "Updated delegate",
      statement: "Original statement",
    });
  });
});
