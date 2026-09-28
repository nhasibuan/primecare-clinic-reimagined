import { z } from "zod";
import { COOKIE_NAME, DB_UNAVAILABLE_ERR_MSG } from "../shared/const";
import { TRPCError } from "@trpc/server";
import { normalizeAssetFileName, decodeMediaUpload } from "./clinicContent";
import {
  addQueueEntry,
  callQueueEntry,
  completeQueueEntry,
  createAppointmentRequest,
  createMediaAsset,
  createWhatsAppFollowUpActivity,
  demoteUser,
  eq,
  getActiveQueueNumber,
  getAdminClinicContent,
  getAppointmentRequests,
  getCaptchaEnabled,
  getDb,
  getDbOrFail,
  getOsdSettings,
  getPublicClinicContent,
  getPublicQueueEntries,
  getQueueEntries,
  getWhatsAppFollowUpActivities,
  listUsers,
  promoteUser,
  requireDb,
  resetQueue,
  saveClinicProfile,
  saveService,
  saveWhatsAppSignatureTemplate,
  skipQueueEntry,
  updateAppointmentRequestStatus,
  updateOsdSettings,
  updatePatientData,
  validateAppointmentTime,
  type TimeValidationResult,
  clinicProfiles,
} from "./db";
import {
  appointmentSubmissionRateLimiter,
  getClientIp,
  isAutomatedAppointmentRequest,
  normalizeAppointmentNote,
} from "./appointmentRequest";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { getTurnstileVerificationSecret, verifyTurnstileToken } from "./turnstile";
import { MAX_WHATSAPP_DRAFT_LENGTH } from "../shared/whatsappMessageMetrics";
import { CLINIC_SCHEDULE } from "./clinicSchedule";
import { InMemoryRateLimiter } from "./rateLimiter";
import { recordAuditLog } from "./auditLog";

// Per-user upload limiter: max 20 uploads per 5-minute window.
const uploadLimiter = new InMemoryRateLimiter({
  maxRequests: 20,
  windowMs: 5 * 60_000,
});

const profileInput = z.object({
  name: z.string().min(2).max(160),
  tagline: z.string().min(2).max(255),
  address: z.string().min(8).max(2000),
  whatsappUrl: z.string().url().refine(value => /^https:\/\/wa\.me\/\d+$/.test(value), "Use an official wa.me WhatsApp link."),
  instagramUrl: z.string().url().nullable().optional(),
});

const serviceInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(2).max(160),
  summary: z.string().min(8).max(4000),
  imageUrl: z.string().min(1).max(2000).refine(
    value => value.startsWith("/manus-storage/") || value.startsWith("data:image/"),
    "Image URL must reference an uploaded asset."
  ),
  sortOrder: z.number().int().min(0).max(999),
  isPublished: z.boolean(),
});

const appointmentInput = z.object({
  fullName: z.string().trim().min(2).max(160),
  contactNumber: z
    .string()
    .trim()
    .min(8)
    .max(40)
    .regex(/^[0-9+\-\s]*[0-9][0-9+\-\s]*$/, "Gunakan nomor telepon atau WhatsApp yang valid."),
  service: z.string().trim().min(2).max(160),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Gunakan tanggal pilihan yang valid."),
  preferredHour: z.string().regex(/^\d{1,2}$/, "Gunakan jam yang valid."),
  preferredMinute: z.string().regex(/^(00|15|30|45)$/, "Gunakan menit yang valid."),
  preferredPeriod: z.enum(["AM", "PM"]),
  note: z.string().trim().max(600).optional(),
  consent: z.literal(true),
  website: z.string().max(255).optional(),
  captchaToken: z.string().trim().max(2048).optional(),
});

const followUpActivityFilterInput = z.object({
  messageStatus: z.enum(["draft_copied", "whatsapp_opened"]).optional(),
  startAt: z.date().optional(),
  endAt: z.date().optional(),
}).superRefine((input, context) => {
  if (input.startAt && input.endAt && input.startAt > input.endAt) {
    context.addIssue({ code: "custom", message: "Tanggal mulai tidak boleh setelah tanggal akhir.", path: ["endAt"] });
  }
});

export const appRouter = router({
  system: systemRouter,
  schedule: router({
    getSchedule: publicProcedure.query(() => CLINIC_SCHEDULE),
  }),
  captcha: router({
    getEnabled: publicProcedure.query(() => getCaptchaEnabled()),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  appointments: router({
    create: publicProcedure.input(appointmentInput).mutation(async ({ ctx, input }) => {
      if (isAutomatedAppointmentRequest(input.website)) return { success: true, requestId: null } as const;
      const clientIp = getClientIp(ctx.req);

      // Require CAPTCHA only when enabled in clinic profile
      const captchaEnabled = await getCaptchaEnabled();
      if (captchaEnabled) {
        if (!input.captchaToken) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Verifikasi keamanan diperlukan. Selesaikan captcha sebelum mengirim permintaan.",
          });
        }

        const verification = await verifyTurnstileToken(input.captchaToken, clientIp, getTurnstileVerificationSecret());
        if (!verification.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Verifikasi keamanan tidak berhasil. Silakan coba lagi.",
          });
        }
      }

      // Server-side schedule re-validation: reject times outside operating hours
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

      // The solved token is single-use at the provider. It is intentionally
      // neither persisted nor included in the appointment request.

      // Rate limiting is still enforced as an additional layer of defense
      const limit = appointmentSubmissionRateLimiter.attempt(clientIp);
      if (!limit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Terlalu banyak permintaan kunjungan. Silakan tunggu beberapa saat sebelum mencoba lagi.",
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
    }),
    list: adminProcedure.query(() => getAppointmentRequests()),
    updateStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["new", "contacted", "closed"]) }))
      .mutation(async ({ ctx, input }) => {
        const result = await updateAppointmentRequestStatus(input.id, input.status);
        await recordAuditLog({ actorId: ctx.user.id, action: "appointment.updateStatus", entityType: "appointment", entityId: input.id, detail: `status → ${input.status}`, ipAddress: getClientIp(ctx.req) });
        return result;
      }),
    listFollowUpActivities: adminProcedure.input(followUpActivityFilterInput.optional()).query(({ input }) => getWhatsAppFollowUpActivities(input)),
    recordFollowUpActivity: adminProcedure
      .input(z.object({
        appointmentRequestId: z.number().int().positive(),
        messageStatus: z.enum(["draft_copied", "whatsapp_opened"]),
        finalDraftLength: z.number().int().min(0).max(MAX_WHATSAPP_DRAFT_LENGTH),
      }))
      .mutation(({ ctx, input }) => createWhatsAppFollowUpActivity({ ...input, recordedBy: ctx.user.id })),
    updateSignatureTemplate: adminProcedure
      .input(z.object({ content: z.string().trim().min(2).max(1000) }))
      .mutation(({ ctx, input }) => saveWhatsAppSignatureTemplate(input.content, ctx.user.id)),
    updatePatientData: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        nik: z.string().trim().max(30).refine(
          value => {
            if (!value) return true; // optional field, empty is OK
            return /^\d{1,16}$/.test(value); // NIK harus 1-16 digit angka
          },
          { message: "NIK harus berupa angka 1-16 digit." }
        ).optional(),
        tempatLahir: z.string().trim().max(100).optional(),
        tanggalLahir: z.string().trim().max(10).refine(
          value => {
            if (!value) return true;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
            const [year, month, day] = value.split("-").map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));
            if (isNaN(date.getTime())) return false;
            const today = new Date();
            const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
            return date.getTime() < todayUtc;
          },
          { message: "Tanggal lahir tidak valid atau bukan tanggal di masa lalu." }
        ).optional(),
        alamatLengkap: z.string().trim().max(500).optional(),
        agama: z.string().trim().max(50).refine(
          value => {
            if (!value) return true;
            return ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Khonghucu", "Tidak ada", ""].includes(value);
          },
          { message: "Agama tidak dikenali. Gunakan salah satu yang tersedia." }
        ).optional(),
        email: z.string().trim().max(255).refine(
          value => {
            if (!value) return true;
            // RFC 5322 simplified: local@domain.tld
            return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
          },
          { message: "Format email tidak valid." }
        ).optional(),
        instagramUrl: z.string().trim().max(255).refine(
          value => {
            if (!value) return true;
            try {
              const url = new URL(value.startsWith("@") ? `https://instagram.com/${value.slice(1)}` : value);
              return url.hostname === "instagram.com" || url.hostname === "www.instagram.com";
            } catch {
              return false;
            }
          },
          { message: "URL Instagram tidak valid." }
        ).optional(),
      }))
      .mutation(({ input }) => updatePatientData(input.id, {
        nik: input.nik ?? undefined,
        tempatLahir: input.tempatLahir ?? undefined,
        tanggalLahir: input.tanggalLahir ?? undefined,
        alamatLengkap: input.alamatLengkap ?? undefined,
        agama: input.agama ?? undefined,
        email: input.email ?? undefined,
        instagramUrl: input.instagramUrl ?? undefined,
      })),
  }),
  admin: router({
    listUsers: adminProcedure.query(() => listUsers()),
    toggleCaptcha: adminProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = requireDb(await getDb());
        const [profile] = await db.select().from(clinicProfiles).limit(1);
        if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Profil klinik tidak ditemukan." });
        await db.update(clinicProfiles).set({ captchaEnabled: input.enabled }).where(eq(clinicProfiles.id, profile.id));
        await recordAuditLog({ actorId: ctx.user.id, action: "captcha.toggle", entityType: "clinic", entityId: profile.id, detail: `captcha → ${input.enabled}`, ipAddress: getClientIp(ctx.req) });
        return { enabled: input.enabled };
      }),
    promoteUser: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Anda tidak dapat menaikkan diri sendiri." });
        }
        const result = await promoteUser(input.userId);
        await recordAuditLog({ actorId: ctx.user.id, action: "user.promote", entityType: "user", entityId: input.userId, ipAddress: getClientIp(ctx.req) });
        return result;
      }),
    demoteUser: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Anda tidak dapat menurunkan diri sendiri. Minta administrator lain yang melakukannya." });
        }
        const result = await demoteUser(input.userId);
        await recordAuditLog({ actorId: ctx.user.id, action: "user.demote", entityType: "user", entityId: input.userId, ipAddress: getClientIp(ctx.req) });
        return result;
      }),
  }),
  clinic: router({
    publicContent: publicProcedure.query(async () => {
      try {
        return await getPublicClinicContent();
      } catch (error) {
        if (error instanceof Error && error.message.includes("temporarily unavailable")) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: DB_UNAVAILABLE_ERR_MSG });
        }
        throw error;
      }
    }),
    adminContent: adminProcedure.query(() => getAdminClinicContent()),
    updateProfile: adminProcedure.input(profileInput).mutation(({ input }) => saveClinicProfile(input)),
    saveService: adminProcedure.input(serviceInput).mutation(({ input }) => saveService(input)),
    uploadMedia: adminProcedure
      .input(z.object({
        fileName: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(120),
        dataBase64: z.string().min(1).max(7_000_000),
        altText: z.string().min(2).max(255),
        category: z.enum(["brand", "service", "clinician", "facility", "document"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!uploadLimiter.attempt(String(ctx.user.id)).allowed) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Terlalu banyak unggahan. Silakan coba lagi nanti." });
        }
        const buffer = decodeMediaUpload(input);
        const fileName = normalizeAssetFileName(input.fileName);
        const stored = await storagePut(`clinic/${ctx.user.id}/${fileName}`, buffer, input.mimeType);
        const asset = await createMediaAsset({
          storageKey: stored.key,
          publicUrl: stored.url,
          fileName,
          altText: input.altText,
          mimeType: input.mimeType,
          category: input.category,
          uploadedBy: ctx.user.id,
        });
        await recordAuditLog({ actorId: ctx.user.id, action: "clinic.uploadMedia", entityType: "media", entityId: asset.id, detail: `${input.category}/${fileName}`, ipAddress: getClientIp(ctx.req) });
        return asset;
      }),
  }),
  queue: router({
    // Public endpoints for the OSD display
    display: publicProcedure.query(async () => {
      const [entries, activeNumber, settings] = await Promise.all([
        getPublicQueueEntries(),
        getActiveQueueNumber(),
        getOsdSettings(),
      ]);
      return { entries, activeNumber, settings };
    }),
    // Admin endpoints for queue management
    list: adminProcedure.query(() => getQueueEntries()),
    settings: adminProcedure.query(() => getOsdSettings()),
    add: adminProcedure
      .input(z.object({
        patientName: z.string().trim().min(1).max(160),
        poli: z.string().trim().min(1).max(160),
        doctorName: z.string().trim().min(1).max(160),
        appointmentRequestId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await addQueueEntry(input);
        await recordAuditLog({ actorId: ctx.user.id, action: "queue.add", entityType: "queue", entityId: result.queueNumber, detail: `${input.patientName} → ${input.poli}`, ipAddress: getClientIp(ctx.req) });
        return result;
      }),
    callNext: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const result = await callQueueEntry(input.id);
        await recordAuditLog({ actorId: ctx.user.id, action: "queue.callNext", entityType: "queue", entityId: input.id, ipAddress: getClientIp(ctx.req) });
        return result;
      }),
    complete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const result = await completeQueueEntry(input.id);
        await recordAuditLog({ actorId: ctx.user.id, action: "queue.complete", entityType: "queue", entityId: input.id, ipAddress: getClientIp(ctx.req) });
        return result;
      }),
    skip: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const result = await skipQueueEntry(input.id);
        await recordAuditLog({ actorId: ctx.user.id, action: "queue.skip", entityType: "queue", entityId: input.id, ipAddress: getClientIp(ctx.req) });
        return result;
      }),
    reset: adminProcedure.mutation(async ({ ctx }) => {
      const result = await resetQueue();
      await recordAuditLog({ actorId: ctx.user.id, action: "queue.reset", entityType: "queue", ipAddress: getClientIp(ctx.req) });
      return result;
    }),
    updateSettings: adminProcedure
      .input(z.object({
        runningText: z.string().max(1000).optional(),
        youtubeUrl: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await updateOsdSettings(input);
        await recordAuditLog({ actorId: ctx.user.id, action: "queue.updateSettings", entityType: "osd", ipAddress: getClientIp(ctx.req) });
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
