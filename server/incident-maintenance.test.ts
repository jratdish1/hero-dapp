import { afterEach, describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";

import type { TrpcContext } from "./_core/context";
import {
  INCIDENT_ALLOWED_MUTATIONS,
  INCIDENT_PAUSED_MUTATIONS,
  INCIDENT_SERVER_PAUSED_ERROR,
  INCIDENT_DCA_RESUME_ERROR,
  V3_GATED_MUTATIONS,
  V3_NOT_LIVE_ERROR,
  assertDcaStatusAllowed,
  assertIncidentMutationAllowed,
  isServerIncidentMaintenanceOn,
  isServerV3ContractsLive,
} from "./_core/incident-maintenance";
import { appRouter } from "./routers";

// HERO incident 2026-10-07, IR P2 thread LInS: server-side DAO / spin / giveaway pause.
function ctxWithBoundWallet(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "incident-test-user",
      email: "incident@test.com",
      name: "Incident Test",
      loginMethod: "manus",
      role: "user",
      walletAddress: "0x35a51dfc82032682e4bda8aaca87b9bc386c3d27",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as unknown as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

const original = process.env.HERO_INCIDENT_MAINTENANCE;
afterEach(() => {
  if (original === undefined) delete process.env.HERO_INCIDENT_MAINTENANCE;
  else process.env.HERO_INCIDENT_MAINTENANCE = original;
});

describe("server incident maintenance flag", () => {
  it("defaults ON and only an exact \"false\" turns it off", () => {
    expect(isServerIncidentMaintenanceOn({})).toBe(true);
    expect(isServerIncidentMaintenanceOn({ HERO_INCIDENT_MAINTENANCE: "true" })).toBe(true);
    expect(isServerIncidentMaintenanceOn({ HERO_INCIDENT_MAINTENANCE: "0" })).toBe(true);
    expect(isServerIncidentMaintenanceOn({ HERO_INCIDENT_MAINTENANCE: "false" })).toBe(false);
  });

  it("rejects every paused mutation while ON and allows them while OFF", () => {
    for (const path of INCIDENT_PAUSED_MUTATIONS) {
      expect(() => assertIncidentMutationAllowed(path, "mutation", {})).toThrow(INCIDENT_SERVER_PAUSED_ERROR);
      expect(() =>
        assertIncidentMutationAllowed(path, "mutation", { HERO_INCIDENT_MAINTENANCE: "false", HERO_V3_CONTRACTS_LIVE: "true" }),
      ).not.toThrow();
    }
  });

  it("keeps DAO and swap writes closed until v3 is live, even with maintenance OFF", () => {
    expect(isServerV3ContractsLive({})).toBe(false);
    expect(isServerV3ContractsLive({ HERO_V3_CONTRACTS_LIVE: "1" })).toBe(false);
    expect(isServerV3ContractsLive({ HERO_V3_CONTRACTS_LIVE: "TRUE" })).toBe(false);
    expect(isServerV3ContractsLive({ HERO_V3_CONTRACTS_LIVE: "true" })).toBe(true);
    const off = { HERO_INCIDENT_MAINTENANCE: "false" };
    for (const path of V3_GATED_MUTATIONS) {
      expect(path.startsWith("dao.") || path === "swap.record").toBe(true);
      expect(() => assertIncidentMutationAllowed(path, "mutation", off)).toThrow(V3_NOT_LIVE_ERROR);
      expect(() => assertIncidentMutationAllowed(path, "query", off)).not.toThrow();
    }
    // Every dao.* mutation is gated; non-DAO paused mutations reopen with maintenance alone.
    for (const path of INCIDENT_PAUSED_MUTATIONS) {
      if (path.startsWith("dao.")) expect(V3_GATED_MUTATIONS.has(path)).toBe(true);
    }
    expect(() => assertIncidentMutationAllowed("spin.execute", "mutation", off)).not.toThrow();
  });

  it("dca.updateStatus may pause or cancel during maintenance but not resume", () => {
    expect(() => assertDcaStatusAllowed("active", {})).toThrow(INCIDENT_DCA_RESUME_ERROR);
    for (const st of ["paused", "completed", "cancelled"]) expect(() => assertDcaStatusAllowed(st, {})).not.toThrow();
    expect(() => assertDcaStatusAllowed("active", { HERO_INCIDENT_MAINTENANCE: "false" })).not.toThrow();
  });

  it("never blocks queries or unrelated mutations", () => {
    expect(() => assertIncidentMutationAllowed("dao.proposals.list", "query", {})).not.toThrow();
    expect(() => assertIncidentMutationAllowed("dao.votes.cast", "query", {})).not.toThrow();
    expect(() => assertIncidentMutationAllowed("auth.logout", "mutation", {})).not.toThrow();
  });

  it("covers the DAO, spin and giveaway write paths named by IR", () => {
    for (const path of ["dao.proposals.create", "dao.votes.cast", "dao.proposals.updateStatus", "spin.execute", "raffle.enter"]) {
      expect(INCIDENT_PAUSED_MUTATIONS.has(path)).toBe(true);
    }
  });
});

describe("every tRPC mutation is classified", () => {
  it("each mutation is in exactly one of the paused / allowed sets", () => {
    const procedures = (appRouter as unknown as { _def: { procedures: Record<string, { _def: { type: string } }> } })._def.procedures;
    const mutations = Object.entries(procedures).filter(([, p]) => p._def.type === "mutation").map(([path]) => path);
    expect(mutations.length).toBeGreaterThan(0);
    const unclassified = mutations.filter((m) => !INCIDENT_PAUSED_MUTATIONS.has(m) && !INCIDENT_ALLOWED_MUTATIONS.has(m));
    const both = mutations.filter((m) => INCIDENT_PAUSED_MUTATIONS.has(m) && INCIDENT_ALLOWED_MUTATIONS.has(m));
    expect(unclassified).toEqual([]);
    expect(both).toEqual([]);
    const stale = [...INCIDENT_PAUSED_MUTATIONS, ...INCIDENT_ALLOWED_MUTATIONS].filter((m) => !mutations.includes(m));
    expect(stale).toEqual([]);
  });
});

describe("tRPC router honours the incident pause", () => {
  it("rejects dao.votes.cast from a bound, signed-in account with the maintenance error", async () => {
    delete process.env.HERO_INCIDENT_MAINTENANCE;
    const caller = appRouter.createCaller(ctxWithBoundWallet());
    const error = await caller.dao.votes.cast({
      proposalDbId: 1,
      proposalId: "HERO-A1-TEST",
      voterAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
      choice: "for",
      chain: "base",
    }).catch(e => e);
    expect(error).toBeInstanceOf(TRPCError);
    expect(error.code).toBe("PRECONDITION_FAILED");
    expect(error.message).toBe(INCIDENT_SERVER_PAUSED_ERROR);
  });

  it("rejects dao.proposals.create and raffle.enter with the maintenance error", async () => {
    delete process.env.HERO_INCIDENT_MAINTENANCE;
    const caller = appRouter.createCaller(ctxWithBoundWallet());
    await expect(caller.dao.proposals.create({
      title: "t",
      description: "d",
      walletAddress: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
    })).rejects.toThrow(INCIDENT_SERVER_PAUSED_ERROR);
    await expect(caller.raffle.enter({
      raffleId: "r1",
      wallet: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
      heroBalance: "1",
    })).rejects.toThrow(INCIDENT_SERVER_PAUSED_ERROR);
  });

  it("passes through to the original handler when OFF (guard re-arms only by flag)", async () => {
    process.env.HERO_INCIDENT_MAINTENANCE = "false";
    const caller = appRouter.createCaller(ctxWithBoundWallet());
    const error = await caller.raffle.enter({
      raffleId: "does-not-exist",
      wallet: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
      heroBalance: "1",
    }).catch(e => e);
    expect(error?.message).not.toBe(INCIDENT_SERVER_PAUSED_ERROR);
  });

  it("rejects dao.votes.cast with the v3 error when maintenance is OFF but v3 is not live", async () => {
    process.env.HERO_INCIDENT_MAINTENANCE = "false";
    delete process.env.HERO_V3_CONTRACTS_LIVE;
    const caller = appRouter.createCaller(ctxWithBoundWallet());
    const error = await (caller.dao.votes.cast as (i: unknown) => Promise<unknown>)({}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).message).toBe(V3_NOT_LIVE_ERROR);
  });

  it("rejects resuming a DCA order through the router during maintenance", async () => {
    delete process.env.HERO_INCIDENT_MAINTENANCE;
    const caller = appRouter.createCaller(ctxWithBoundWallet());
    await expect(caller.dca.updateStatus({ orderId: 1, status: "active" })).rejects.toThrow(INCIDENT_DCA_RESUME_ERROR);
  });
});
