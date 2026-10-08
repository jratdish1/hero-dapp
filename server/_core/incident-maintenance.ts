import { TRPCError } from "@trpc/server";

/**
 * HERO incident 2026-10-07 (HERO signer compromise), IR P2 thread LInS.
 *
 * Server-side mirror of client/src/lib/incident-flags.ts. While maintenance is
 * on, the tRPC mutations below are rejected for every caller, so a stale
 * pre-maintenance tab or a direct /api/trpc request cannot keep changing DAO,
 * spin or giveaway state while the UI says those features are paused. These
 * mutations are session-authenticated and do not need a fresh wallet
 * signature per call, which is why the client-side pause alone is not enough.
 *
 * Default is ON. Set HERO_INCIDENT_MAINTENANCE="false" in the server env only
 * after the owner confirms key rotation on-chain. Read at call time.
 */
export const INCIDENT_PAUSED_MUTATIONS: ReadonlySet<string> = new Set([
  "dao.wallet.bindForVoting",
  "dao.proposals.create",
  "dao.proposals.updateStatus",
  "dao.votes.cast",
  "dao.delegates.register",
  "dao.delegates.update",
  "dao.delegations.create",
  "dao.delegations.revoke",
  "dao.treasury.record",
  "spin.execute",
  "spin.claim",
  "raffle.enter",
]);

export const INCIDENT_SERVER_PAUSED_ERROR =
  "Paused for maintenance (HERO incident): DAO, staking, Spin the Wheel and giveaway writes are disabled while contract keys are rotated.";

export function isServerIncidentMaintenanceOn(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (env.HERO_INCIDENT_MAINTENANCE ?? "true") !== "false";
}

export function isIncidentPausedMutation(path: string, type: string): boolean {
  return type === "mutation" && INCIDENT_PAUSED_MUTATIONS.has(path);
}

/** Throws a PRECONDITION_FAILED TRPCError for a paused mutation while maintenance is on. */
export function assertIncidentMutationAllowed(
  path: string,
  type: string,
  env: Record<string, string | undefined> = process.env,
): void {
  if (isServerIncidentMaintenanceOn(env) && isIncidentPausedMutation(path, type)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: INCIDENT_SERVER_PAUSED_ERROR });
  }
}
