import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getRpcMetrics } from "../routers";
import { getDaoMigrationStatus } from "../dao-advisory-migration";

const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;

function getReleaseSha(): string {
  const releaseSha = process.env.HERO_RELEASE_SHA?.trim();
  return releaseSha && RELEASE_SHA_PATTERN.test(releaseSha) ? releaseSha : "unknown";
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
      version: process.env.npm_package_version || "unknown",
      releaseSha: getReleaseSha(),
      uptime: process.uptime(),
      rpc: getRpcMetrics(),
      daoGovernance: {
        mode: "advisory",
        bindingVotingEnabled: false,
        delegationEnabled: false,
        migration: getDaoMigrationStatus(),
      },
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
