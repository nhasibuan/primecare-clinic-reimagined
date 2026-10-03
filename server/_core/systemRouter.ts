import { z } from "zod";
import { notifyOwner } from "./notification";
import { getLimiterStats } from "../rateLimiterMetrics";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  /**
   * Operational telemetry for the pluggable rate limiters (admin only):
   * which backend each limiter runs on and how often it has degraded.
   * Backs the WO strategic initiative on limiter observability.
   */
  rateLimiterStatus: adminProcedure.query(() => getLimiterStats()),

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
