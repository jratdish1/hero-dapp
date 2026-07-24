/**
 * Historical DAO Integration Note
 * ===============================
 *
 * The alternate `dao-router-production.ts` and `dao-router-hardened.ts`
 * implementations were retired during the July 2026 production audit because
 * neither module was imported by the running application. Their active,
 * reviewed behavior now lives directly in `server/routers.ts`, including:
 *
 * - authenticated wallet binding for DAO mutations;
 * - persistent proposal rate limiting;
 * - proposal content hashing and anchoring;
 * - read-only Snapshot integration;
 * - treasury, voting, delegation, and proposal procedures.
 *
 * Do not re-introduce a parallel DAO router. Changes belong in the active
 * router and must be covered by tests and the exact-head CI gate.
 */

export {};
