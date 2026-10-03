/**
 * Clinic domain router.
 *
 * Exposes public clinic content (profile + services) and admin operations
 * for updating clinic data, managing media assets, and saving service
 * listings.
 *
 * Per-user upload rate limiting is scoped to this module so it cannot be
 * accidentally shared with other domains.
 */

import { TRPCError } from "@trpc/server";
import { DB_UNAVAILABLE_ERR_MSG } from "@shared/const";
import {
  createMediaAsset,
  getAdminClinicContent,
  getPublicClinicContent,
  saveClinicProfile,
  saveService,
} from "../repositories/clinicRepository";
import { getClientIp } from "../appointmentRequest";
import { recordAuditLog } from "../auditLog";
import { createRateLimiter } from "../rateLimiterFactory";
import { storagePut } from "../storage";
import { normalizeAssetFileName, decodeMediaUpload } from "../utils/mediaUtils";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { profileInput, serviceInput, uploadMediaInput } from "../schemas";

/**
 * Per-user upload rate limiter: max 20 uploads per 5-minute window.
 * Module-scoped to ensure isolation and testability; Redis-backed when
 * REDIS_URL is set (shared quota across instances).
 */
const uploadLimiter = createRateLimiter(
  {
    maxRequests: 20,
    windowMs: 5 * 60_000,
  },
  "clinic:uploadMedia"
);

export const clinicRouter = router({
  /**
   * Public: returns the clinic profile and published services.
   * Translates a DB-unavailable error into a tRPC SERVICE_UNAVAILABLE.
   */
  publicContent: publicProcedure.query(async () => {
    try {
      return await getPublicClinicContent();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("temporarily unavailable")
      ) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: DB_UNAVAILABLE_ERR_MSG,
        });
      }
      throw error;
    }
  }),

  /** Admin: returns the full clinic content including unpublished items. */
  adminContent: adminProcedure.query(() => getAdminClinicContent()),

  /** Admin: update the clinic profile fields. */
  updateProfile: adminProcedure
    .input(profileInput)
    .mutation(({ input }) => saveClinicProfile(input)),

  /** Admin: create or update a service listing. */
  saveService: adminProcedure
    .input(serviceInput)
    .mutation(({ input }) => saveService(input)),

  /**
   * Admin: upload a media asset (image or PDF).
   *
   * The client sends the file as a base64-encoded string to avoid
   * multipart form handling.  A separate body-size limit is set in
   * `server/_core/index.ts` for this specific tRPC path.
   */
  uploadMedia: adminProcedure
    .input(uploadMediaInput)
    .mutation(async ({ ctx, input }) => {
      if (!(await uploadLimiter.attempt(String(ctx.user.id))).allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Terlalu banyak unggahan. Silakan coba lagi nanti.",
        });
      }

      const buffer = decodeMediaUpload(input);
      const fileName = normalizeAssetFileName(input.fileName);
      const stored = await storagePut(
        `clinic/${ctx.user.id}/${fileName}`,
        buffer,
        input.mimeType
      );

      const asset = await createMediaAsset({
        storageKey: stored.key,
        publicUrl: stored.url,
        fileName,
        altText: input.altText,
        mimeType: input.mimeType,
        category: input.category,
        uploadedBy: ctx.user.id,
      });

      await recordAuditLog({
        actorId: ctx.user.id,
        action: "clinic.uploadMedia",
        entityType: "media",
        entityId: asset.id,
        detail: `${input.category}/${fileName}`,
        ipAddress: getClientIp(ctx.req),
      });

      return asset;
    }),
});
