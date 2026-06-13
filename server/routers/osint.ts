// server/routers/osint.ts — OSINT wallet monitoring router
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

const FLOWSINT_BASE_URL = process.env.FLOWSINT_URL;

if (!FLOWSINT_BASE_URL && process.env.NODE_ENV === "production") {
  throw new Error("FLOWSINT_URL environment variable must be set in production");
}

// Define zod schemas for response validation

const OsintNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["wallet", "contract", "token", "exchange"]),
  label: z.string(),
  metadata: z.record(z.string(), z.unknown()),
});

const OsintEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.string(),
  weight: z.number(),
});

const OsintGraphSchema = z.object({
  nodes: z.array(OsintNodeSchema),
  edges: z.array(OsintEdgeSchema),
  riskScore: z.number(),
});

const MonitorResponseSchema = z.object({
  id: z.string().min(1),
});

interface OsintNode extends z.infer<typeof OsintNodeSchema> {}
interface OsintEdge extends z.infer<typeof OsintEdgeSchema> {}
interface OsintGraph extends z.infer<typeof OsintGraphSchema> {}

export const osintRouter = router({
  investigateWallet: protectedProcedure
    .input(
      z.object({
        address: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
          .transform((addr) => addr.toLowerCase()),
        depth: z.number().min(1).max(3).default(2),
        chain: z.enum(["pulsechain", "base", "ethereum"]).default("pulsechain"),
      })
    )
    .query(async ({ input }) => {
      if (!FLOWSINT_BASE_URL) {
        // Fail fast if base URL is missing in non-production environment
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "OSINT service URL not configured",
        });
      }

      // Use AbortController for timeout and cancellation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      try {
        const response = await fetch(`${FLOWSINT_BASE_URL}/api/investigate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(input),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Attempt to read error message from response body safely
          let errorBody: unknown = null;
          try {
            errorBody = await response.text();
          } catch {
            // ignore
          }
          console.error(
            `OSINT service responded with status ${response.status}:`,
            errorBody
          );

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `OSINT service error: ${response.status}`,
          });
        }

        // Parse and validate JSON response
        let data: unknown;
        try {
          data = await response.json();
        } catch (jsonErr) {
          console.error("Failed to parse OSINT service JSON response:", jsonErr);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid response from OSINT service",
          });
        }

        const parsed = OsintGraphSchema.safeParse(data);
        if (!parsed.success) {
          console.error("OSINT service response validation failed:", parsed.error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "OSINT service returned invalid data",
          });
        }

        return parsed.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;

        if (err instanceof Error && err.name === "AbortError") {
          console.error("OSINT service request timed out");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "OSINT service request timed out",
          });
        }

        console.error("investigateWallet error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "OSINT service unavailable",
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }),

  monitorContract: protectedProcedure
    .input(
      z.object({
        contractAddress: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid contract address")
          .transform((addr) => addr.toLowerCase()),
        chain: z.enum(["pulsechain", "base"]),
        alertThreshold: z.number().min(0).max(1).default(0.7),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!FLOWSINT_BASE_URL) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "OSINT service URL not configured",
        });
      }

      const userId = String(ctx.user.id);
      if (!userId || userId === "0") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid user ID",
        });
      }

      // Prepare payload with normalized address and validated userId
      const payload = {
        contractAddress: input.contractAddress,
        chain: input.chain,
        alertThreshold: input.alertThreshold,
        webhookUrl: `${process.env.APP_URL}/api/osint/webhook`,
        userId,
      };

      // Use AbortController for timeout and cancellation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch(`${FLOWSINT_BASE_URL}/api/monitor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorBody: unknown = null;
          try {
            errorBody = await response.text();
          } catch {
            // ignore
          }
          console.error(
            `Failed to register monitor, status ${response.status}:`,
            errorBody
          );

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to register monitor",
          });
        }

        let data: unknown;
        try {
          data = await response.json();
        } catch (jsonErr) {
          console.error("Failed to parse monitor registration response:", jsonErr);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid response from OSINT service",
          });
        }

        const parsed = MonitorResponseSchema.safeParse(data);
        if (!parsed.success) {
          console.error("Monitor registration response validation failed:", parsed.error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "OSINT service returned invalid data",
          });
        }

        return { success: true, monitorId: parsed.data.id };
      } catch (err) {
        if (err instanceof TRPCError) throw err;

        if (err instanceof Error && err.name === "AbortError") {
          console.error("Monitor registration request timed out");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "OSINT service request timed out",
          });
        }

        console.error("monitorContract error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "OSINT service unavailable",
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }),
});

/*
  Notes:
  - Consider adding rate limiting middleware to protect these endpoints from abuse.
  - Ensure APP_URL and FLOWSINT_URL environment variables are set securely.
  - Logging avoids sensitive data exposure.
  - All external data is validated strictly with zod schemas.
  - AbortController used to prevent hanging requests.
*/