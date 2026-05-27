import { z } from "zod";
import { execSync } from "child_process";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { TRPCError } from "@trpc/server";

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
      uptime: process.uptime(),
    })),

  /**
   * Deploy endpoint - triggers git pull + build + pm2 reload
   * Protected by DEPLOY_SECRET environment variable (must match X-Deploy-Token header)
   */
  deploy: publicProcedure
    .input(
      z.object({
        token: z.string().min(32, "deploy token required"),
        action: z.enum(["pull", "build", "reload", "full", "purge-cf"]).default("full"),
      })
    )
    .mutation(async ({ input }) => {
      const deploySecret = process.env.DEPLOY_SECRET;
      if (!deploySecret || input.token !== deploySecret) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid deploy token",
        });
      }

      const results: string[] = [];
      const cwd = process.env.APP_ROOT || "/var/www/hero-dapp";

      try {
        if (input.action === "pull" || input.action === "full") {
          const pullResult = execSync("git pull origin main", {
            cwd,
            timeout: 30000,
            encoding: "utf-8",
          });
          results.push(`git pull: ${pullResult.trim()}`);
        }

        if (input.action === "build" || input.action === "full") {
          const buildResult = execSync("npm run build 2>&1 | tail -5", {
            cwd,
            timeout: 120000,
            encoding: "utf-8",
          });
          results.push(`build: ${buildResult.trim()}`);
        }

        if (input.action === "reload" || input.action === "full") {
          const reloadResult = execSync("pm2 reload hero-dapp 2>&1", {
            cwd,
            timeout: 15000,
            encoding: "utf-8",
          });
          results.push(`reload: ${reloadResult.trim()}`);
        }

        if (input.action === "purge-cf") {
          const purgeResult = execSync(
            'source /root/.env_architecture && curl -sX POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" -H "X-Auth-Email: ${CLOUDFLARE_EMAIL}" -H "X-Auth-Key: ${CLOUDFLARE_API_KEY}" -H "Content-Type: application/json" --data \'{"purge_everything":true}\'',
            { cwd, timeout: 15000, encoding: "utf-8", shell: "/bin/bash" }
          );
          results.push(`cf-purge: ${purgeResult.trim()}`);
        }

        return {
          success: true,
          results,
          timestamp: new Date().toISOString(),
        };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Deploy failed: ${err.message}`,
        });
      }
    }),

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
