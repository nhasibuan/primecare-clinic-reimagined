/**
 * Root tRPC application router.
 *
 * This file is the single assembly point for all domain sub-routers.
 * Each sub-router owns its domain's procedures and imports directly
 * from the relevant repositories/services — no logic lives here.
 *
 * Sub-router organisation:
 *   system      — platform health check and runtime info (built-in)
 *   schedule    — public clinic schedule lookup
 *   captcha     — public CAPTCHA enablement flag
 *   auth        — session management (me, logout)
 *   appointments — public submission + admin management
 *   clinic      — public content + admin CMS operations
 *   queue       — OSD display + admin queue management
 *   admin       — user role management and site settings
 */

import { CLINIC_SCHEDULE } from "../../shared/clinicSchedule";
import { getCaptchaEnabled } from "../repositories/clinicRepository";
import { systemRouter } from "../_core/systemRouter";
import { publicProcedure, router } from "../_core/trpc";
import { authRouter } from "./authRouter";
import { appointmentsRouter } from "./appointmentsRouter";
import { clinicRouter } from "./clinicRouter";
import { queueRouter } from "./queueRouter";
import { adminRouter } from "./adminRouter";

export const appRouter = router({
  system: systemRouter,

  /** Public: returns the full clinic operating schedule. */
  schedule: router({
    getSchedule: publicProcedure.query(() => CLINIC_SCHEDULE),
  }),

  /** Public: whether the appointment form requires CAPTCHA verification. */
  captcha: router({
    getEnabled: publicProcedure.query(() => getCaptchaEnabled()),
  }),

  auth: authRouter,
  appointments: appointmentsRouter,
  clinic: clinicRouter,
  queue: queueRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
