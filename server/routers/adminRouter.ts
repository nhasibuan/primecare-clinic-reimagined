/**
 * Admin domain router.
 *
 * Handles user management (listing, role promotion/demotion) and site-wide
 * administrative settings such as the CAPTCHA toggle.
 *
 * All procedures require admin role — enforced by `adminProcedure`.
 */

import { TRPCError } from "@trpc/server";
import {
  demoteUser,
  listUsers,
  promoteUser,
} from "../repositories/userRepository";
import { toggleCaptchaEnabled } from "../repositories/clinicRepository";
import { getClientIp } from "../appointmentRequest";
import { recordAuditLog } from "../auditLog";
import { adminProcedure, router } from "../_core/trpc";
import { toggleCaptchaInput, userIdInput } from "../schemas";

export const adminRouter = router({
  /** Returns all registered users ordered by last sign-in. */
  listUsers: adminProcedure.query(() => listUsers()),

  /**
   * Enables or disables the Turnstile CAPTCHA on the public appointment form.
   * Uses the repository layer — no raw ORM access in the router.
   */
  toggleCaptcha: adminProcedure
    .input(toggleCaptchaInput)
    .mutation(async ({ ctx, input }) => {
      const result = await toggleCaptchaEnabled(input.enabled).catch((err) => {
        if (
          err instanceof Error &&
          err.message.includes("tidak ditemukan")
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Profil klinik tidak ditemukan.",
          });
        }
        throw err;
      });

      await recordAuditLog({
        actorId: ctx.user.id,
        action: "captcha.toggle",
        entityType: "clinic",
        entityId: result.profileId,
        detail: `captcha → ${input.enabled}`,
        ipAddress: getClientIp(ctx.req),
      });

      return { enabled: result.enabled };
    }),

  /**
   * Promotes a regular user to the admin role.
   * Self-promotion is blocked at the router level as an explicit guard.
   */
  promoteUser: adminProcedure
    .input(userIdInput)
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Anda tidak dapat menaikkan diri sendiri.",
        });
      }
      const result = await promoteUser(input.userId);
      await recordAuditLog({
        actorId: ctx.user.id,
        action: "user.promote",
        entityType: "user",
        entityId: input.userId,
        ipAddress: getClientIp(ctx.req),
      });
      return result;
    }),

  /**
   * Demotes an admin to a regular user role.
   * Self-demotion is blocked to prevent accidental lockout.
   */
  demoteUser: adminProcedure
    .input(userIdInput)
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Anda tidak dapat menurunkan diri sendiri. Minta administrator lain yang melakukannya.",
        });
      }
      const result = await demoteUser(input.userId);
      await recordAuditLog({
        actorId: ctx.user.id,
        action: "user.demote",
        entityType: "user",
        entityId: input.userId,
        ipAddress: getClientIp(ctx.req),
      });
      return result;
    }),
});
