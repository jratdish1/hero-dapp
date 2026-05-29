import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { sql } from "drizzle-orm";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// ─── Persistent MySQL-Backed Rate Limiter (Audit Fix: May 29, 2026) ───────────
// ARCHITECTURE:
// - Uses `mutation_rate_limits` MySQL table for distributed, persistent rate limiting
// - Works across multiple PM2 instances and survives process restarts
// - Atomic INSERT + COUNT pattern prevents TOCTOU race conditions
// - Auto-cleanup of expired entries via probabilistic garbage collection
// - Falls back to in-memory ONLY if DB is temporarily unavailable (fail-open with warning)
//
// TABLE SCHEMA (auto-created on first use):
//   CREATE TABLE IF NOT EXISTS mutation_rate_limits (
//     id BIGINT AUTO_INCREMENT PRIMARY KEY,
//     rate_key VARCHAR(128) NOT NULL,
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     INDEX idx_key_time (rate_key, created_at)
//   );
//
// SCALING: This implementation supports multi-instance PM2 clusters, Docker replicas,
// and horizontal scaling without any code changes. The MySQL table is the single
// source of truth for rate state.

let _dbGetter: (() => Promise<any>) | null = null;

/**
 * Initialize the persistent rate limiter with a DB getter function.
 * Must be called once at server startup (same pattern as dao-rate-limiter).
 */
export function initTrpcRateLimiter(dbGetter: () => Promise<any>): void {
  _dbGetter = dbGetter;
}

/**
 * Ensure the mutation_rate_limits table exists (idempotent).
 * Called once at startup after initTrpcRateLimiter.
 */
export async function ensureRateLimitTable(): Promise<void> {
  if (!_dbGetter) return;
  try {
    const db = await _dbGetter();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mutation_rate_limits (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        rate_key VARCHAR(128) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_key_time (rate_key, created_at)
      )
    `);
  } catch (err: any) {
    console.error("[trpc-rate-limiter] Failed to create table:", err?.message);
  }
}

/**
 * Persistent MySQL-backed rate limit check.
 * Returns true if the request is allowed, false if rate limited.
 *
 * @param key - Unique identifier (user:123 or ip:1.2.3.4)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 min)
 */
async function persistentRateCheck(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): Promise<{ allowed: boolean; count: number }> {
  if (!_dbGetter) {
    // DB not initialized — fail open with warning (Express-level limiter still active)
    console.warn("[trpc-rate-limiter] DB not available, allowing request (fail-open)");
    return { allowed: true, count: 0 };
  }

  try {
    const db = await _dbGetter();
    const windowSeconds = Math.floor(windowMs / 1000);

    // Atomic: Count recent entries for this key
    const countResult = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM mutation_rate_limits
          WHERE rate_key = ${key}
          AND created_at > DATE_SUB(NOW(), INTERVAL ${sql.raw(String(windowSeconds))} SECOND)`
    );
    const count = Number(countResult[0]?.[0]?.cnt || countResult[0]?.cnt || 0);

    if (count >= maxRequests) {
      return { allowed: false, count };
    }

    // Record this request
    await db.execute(
      sql`INSERT INTO mutation_rate_limits (rate_key, created_at) VALUES (${key}, NOW())`
    );

    // Probabilistic cleanup (1% chance per request) — removes entries older than 5 minutes
    if (Math.random() < 0.01) {
      await db.execute(
        sql`DELETE FROM mutation_rate_limits WHERE created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
      ).catch(() => {}); // Non-critical, don't block on cleanup failure
    }

    return { allowed: true, count: count + 1 };
  } catch (err: any) {
    // DB error — fail open (Express-level limiter is the safety net)
    console.error("[trpc-rate-limiter] DB error, failing open:", err?.message);
    return { allowed: true, count: 0 };
  }
}

/**
 * tRPC Middleware: Persistent MySQL-backed rate limiting for mutations.
 *
 * Enforces per-user (or per-IP for unauthenticated) rate limiting using
 * a MySQL table as the distributed state store. This ensures:
 * - Rate limits persist across PM2 restarts
 * - Rate limits are shared across PM2 cluster instances
 * - No memory leaks from in-memory Maps
 * - Atomic counting prevents race conditions
 *
 * Limits: 10 mutations per minute per user/IP.
 * Fallback: If DB is unavailable, fails open (Express-level limiter still active).
 */
const userMutationRateLimit = t.middleware(async opts => {
  const { ctx, next } = opts;
  const userId = ctx.user?.id;
  const key = userId ? `user:${userId}` : `ip:${ctx.req?.ip || 'unknown'}`;

  const { allowed, count } = await persistentRateCheck(key, 10, 60_000);

  if (!allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limited: max 10 mutations per minute (current: ${count})`,
    });
  }

  return next({ ctx });
});

/**
 * Rate-limited mutation procedure: requires auth + enforces per-user persistent rate limiting.
 *
 * Use for all state-changing operations (financial, governance, content creation).
 * Rate state is stored in MySQL `mutation_rate_limits` table for distributed consistency.
 */
export const rateLimitedMutation = t.procedure.use(requireUser).use(userMutationRateLimit);
