import { afterEach, describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";

import type { TrpcContext } from "./_core/context";
import {
  INCIDENT_PAUSED_MUTATIONS,
  INCIDENT_SERVER_PAUSED_ERROR,
  assertIncidentMutationAllowed,
  isServerIncidentMaintenanceOn,
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
      expect(() => assertIncidentMutationAllowed(path, "mutation", { HERO_INCIDENT_MAINTENANCE: "false" })).not.toThrow();
    }
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
});
