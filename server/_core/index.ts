import "dotenv/config";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import { listenOrFail, resolveListenOptions } from "./listen";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStandaloneAuthRoutes } from "./standalone-auth";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { ensureDaoAdvisoryBoundary } from "../dao-advisory-migration";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { setupSecurity } from "./security";
import { initTrpcRateLimiter, ensureRateLimitTable } from "./trpc";
import { startMentionScheduler } from "../mentionScheduler";

async function startServer() {
  // The advisory DAO schema is additive and legacy-safe. Verify or install it
  // before exposing any route; partial/drifted states abort startup and keep the
  // previous PM2 release serving during the protected reload.
  await ensureDaoAdvisoryBoundary();

  const app = express();
  app.disable("x-powered-by");
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(compression());
  setupSecurity(app);

  initTrpcRateLimiter(getDb);
  await ensureRateLimitTable();
  registerOAuthRoutes(app);
  registerStandaloneAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const { host, port } = resolveListenOptions();
  await listenOrFail(server, { host, port });
  console.log(`Server running on http://${host}:${port}/`);
  startMentionScheduler();
}

startServer().catch(error => {
  console.error("Fatal server startup failure", error);
  process.exitCode = 1;
});


