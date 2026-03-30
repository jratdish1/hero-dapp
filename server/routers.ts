import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createDcaOrder,
  getDcaOrdersByUser,
  updateDcaOrderStatus,
  createLimitOrder,
  getLimitOrdersByUser,
  cancelLimitOrder,
  recordSwap,
  getSwapHistoryByWallet,
  addToWatchlist,
  getWatchlistByUser,
  removeFromWatchlist,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  dca: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getDcaOrdersByUser(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        walletAddress: z.string().min(42).max(42),
        tokenInAddress: z.string().min(42).max(42),
        tokenInSymbol: z.string().max(20),
        tokenOutAddress: z.string().min(42).max(42),
        tokenOutSymbol: z.string().max(20),
        amountPerInterval: z.string(),
        intervalSeconds: z.number().int().positive(),
        totalIntervals: z.number().int().positive().max(365),
      }))
      .mutation(async ({ ctx, input }) => {
        await createDcaOrder({
          userId: ctx.user.id,
          ...input,
          nextExecutionAt: new Date(),
        });
        return { success: true };
      }),
    updateStatus: protectedProcedure
      .input(z.object({
        orderId: z.number().int().positive(),
        status: z.enum(["active", "paused", "completed", "cancelled"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateDcaOrderStatus(input.orderId, ctx.user.id, input.status);
        return { success: true };
      }),
  }),

  limitOrder: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getLimitOrdersByUser(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        walletAddress: z.string().min(42).max(42),
        tokenInAddress: z.string().min(42).max(42),
        tokenInSymbol: z.string().max(20),
        tokenOutAddress: z.string().min(42).max(42),
        tokenOutSymbol: z.string().max(20),
        amountIn: z.string(),
        targetPrice: z.string(),
        orderType: z.enum(["buy", "sell"]),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createLimitOrder({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
    cancel: protectedProcedure
      .input(z.object({ orderId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await cancelLimitOrder(input.orderId, ctx.user.id);
        return { success: true };
      }),
  }),

  swap: router({
    history: protectedProcedure
      .input(z.object({ walletAddress: z.string().min(42).max(42) }))
      .query(async ({ input }) => {
        return getSwapHistoryByWallet(input.walletAddress);
      }),
    record: protectedProcedure
      .input(z.object({
        walletAddress: z.string().min(42).max(42),
        tokenInAddress: z.string().min(42).max(42),
        tokenInSymbol: z.string().max(20),
        tokenOutAddress: z.string().min(42).max(42),
        tokenOutSymbol: z.string().max(20),
        amountIn: z.string(),
        amountOut: z.string(),
        dexSource: z.string().optional(),
        txHash: z.string().optional(),
        gasUsed: z.string().optional(),
        gasless: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await recordSwap({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
  }),

  watchlist: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getWatchlistByUser(ctx.user.id);
    }),
    add: protectedProcedure
      .input(z.object({
        tokenAddress: z.string().min(42).max(42),
        tokenSymbol: z.string().max(20),
      }))
      .mutation(async ({ ctx, input }) => {
        await addToWatchlist({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await removeFromWatchlist(input.id, ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
