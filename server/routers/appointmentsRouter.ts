/**
 * Appointments domain router.
 *
 * Handles public appointment submission (with honeypot, CAPTCHA, rate
 * limiting and schedule validation) and admin management of appointment
 * records, follow-up activities, WhatsApp signature templates and patient
 * demographic data.
 */

import { TRPCError } from "@trpc/server";
import {
  createAppointmentRequest,
  createWhatsAppFollowUpActivity,
  getAppointmentRequests,
  getWhatsAppFollowUpActivities,
  updateAppointmentRequestStatus,
  updatePatientData,
} from "../repositories/appointmentRepository";
import {
  getCaptchaEnabled,
  saveWhatsAppSignatureTemplate,
} from "../repositories/clinicRepository";
import {
  appointmentSubmissionRateLimiter,
  getClientIp,
  isAutomatedAppointmentRequest,
  normalizeAppointmentNote,
} from "../appointmentRequest";
import { recordAuditLog } from "../auditLog";
import { validateAppointmentTime } from "../services/clinicValidation";
import {
  getTurnstileVerificationSecret,
  verifyTurnstileToken,
} from "../turnstile";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import {
  appointmentInput,
  followUpActivityFilterInput,
  recordFollowUpActivityInput,
  updatePatientDataInput,
} from "../schemas";
import { z } from "zod";

export const appointmentsRouter = router({
  /**
   * Public: submit a new appointment request.
   *
   * Protection layers (in order):
   *   1. Honeypot — silently drops bot submissions.
   *   2. Turnstile CAPTCHA — when enabled in clinic profile.
   *   3. Server-side schedule validation.
   *   4. IP-based rate limiting.
   */
  create: publicProcedure.input(appointmentInput).mutation(
    async ({ ctx, input }) => {
      // 1. Honeypot guard — never returns an error to avoid fingerprinting
      if (isAutomatedAppointmentRequest(input.website)) {
        return { success: true, requestId: null } as const;
      }

      const clientIp = getClientIp(ctx.req);

      // 2. CAPTCHA verification (conditional on clinic configuration)
      const captchaEnabled = await getCaptchaEnabled();
      if (captchaEnabled) {
        if (!input.captchaToken) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Verifikasi keamanan diperlukan. Selesaikan captcha sebelum mengirim permintaan.",
          });
        }

        const verification = await verifyTurnstileToken(
          input.captchaToken,
          clientIp,
          getTurnstileVerificationSecret(),
        );
        if (!verification.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Verifikasi keamanan tidak berhasil. Silakan coba lagi.",
          });
        }
      }

      // 3. Server-side schedule re-validation
      const timeCheck = validateAppointmentTime(
        input.service,
        input.preferredDate,
        input.preferredHour,
        input.preferredMinute,
        input.preferredPeriod,
      );
      if (!timeCheck.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: timeCheck.message ?? "Permintaan kunjungan tidak valid.",
        });
      }

      // 4. IP rate limiting (defence-in-depth after CAPTCHA)
      const limit = appointmentSubmissionRateLimiter.attempt(clientIp);
      if (!limit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Terlalu banyak permintaan kunjungan. Silakan tunggu beberapa saat sebelum mencoba lagi.",
        });
      }

      const request = await createAppointmentRequest({
        fullName: input.fullName,
        contactNumber: input.contactNumber,
        service: input.service,
        preferredDate: input.preferredDate,
        preferredTime: `${input.preferredHour}:${input.preferredMinute} ${input.preferredPeriod}`,
        note: normalizeAppointmentNote(input.note),
      });

      return { success: true, requestId: request.id } as const;
    },
  ),

  /** Admin: list all appointment requests (latest first). */
  list: adminProcedure.query(() => getAppointmentRequests()),

  /** Admin: update the lifecycle status of an appointment request. */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["new", "contacted", "closed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await updateAppointmentRequestStatus(
        input.id,
        input.status,
      );
      await recordAuditLog({
        actorId: ctx.user.id,
        action: "appointment.updateStatus",
        entityType: "appointment",
        entityId: input.id,
        detail: `status → ${input.status}`,
        ipAddress: getClientIp(ctx.req),
      });
      return result;
    }),

  /** Admin: list WhatsApp follow-up activity records with optional filters. */
  listFollowUpActivities: adminProcedure
    .input(followUpActivityFilterInput.optional())
    .query(({ input }) => getWhatsAppFollowUpActivities(input)),

  /** Admin: record a WhatsApp follow-up action against an appointment. */
  recordFollowUpActivity: adminProcedure
    .input(recordFollowUpActivityInput)
    .mutation(({ ctx, input }) =>
      createWhatsAppFollowUpActivity({ ...input, recordedBy: ctx.user.id }),
    ),

  /** Admin: update the WhatsApp message signature template. */
  updateSignatureTemplate: adminProcedure
    .input(z.object({ content: z.string().trim().min(2).max(1000) }))
    .mutation(({ ctx, input }) =>
      saveWhatsAppSignatureTemplate(input.content, ctx.user.id),
    ),

  /** Admin: enrich an appointment request with patient demographic data. */
  updatePatientData: adminProcedure
    .input(updatePatientDataInput)
    .mutation(({ input }) =>
      updatePatientData(input.id, {
        nik: input.nik ?? undefined,
        tempatLahir: input.tempatLahir ?? undefined,
        tanggalLahir: input.tanggalLahir ?? undefined,
        alamatLengkap: input.alamatLengkap ?? undefined,
        agama: input.agama ?? undefined,
        email: input.email ?? undefined,
        instagramUrl: input.instagramUrl ?? undefined,
      }),
    ),
});
