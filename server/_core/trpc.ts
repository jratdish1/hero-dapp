import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

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

// ─── Rate-Limited Mutation Procedure (Audit Fix: May 29, 2026) ───
// NOTE: Uses in-memory sliding window which is appropriate for single-instance PM2 deployment.
// For multi-instance scaling, replace with Redis/MySQL-backed rate limiting.
// The Express-level userMutationLimiter provides the persistent layer.
// Applies per-user rate limiting at the tRPC middleware level for all mutations
// that modify state. Limits: 10 mutations/min per user, falls back to IP.
const userMutationRateLimit = t.middleware(async opts => {
  const { ctx, next } = opts;
  const userId = ctx.user?.id;
  const key = userId ? `user:${userId}` : `ip:${ctx.ip || 'unknown'}`;
  
  // In-memory sliding window (per-process, complements the Express-level limiter)
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const maxMutations = 10;
  
  if (!globalThis.__mutationWindows) globalThis.__mutationWindows = new Map();
  const windows = globalThis.__mutationWindows as Map<string, number[]>;
  
  const timestamps = windows.get(key) || [];
  const recent = timestamps.filter(t => t > now - windowMs);
  
  if (recent.length >= maxMutations) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limited: max ${maxMutations} mutations per minute`,
    });
  }
  
  recent.push(now);
  windows.set(key, recent);
  
  // Cleanup old entries every 100 calls
  if (Math.random() < 0.01) {
    for (const [k, v] of windows.entries()) {
      const filtered = v.filter(t => t > now - windowMs);
      if (filtered.length === 0) windows.delete(k);
      else windows.set(k, filtered);
    }
  }
  
  return next({ ctx });
});

/**
 * Rate-limited mutation procedure: requires auth + enforces per-user rate limiting.
 * Use for all state-changing operations (financial, governance, content creation).
 */
export const rateLimitedMutation = t.procedure.use(requireUser).use(userMutationRateLimit);
