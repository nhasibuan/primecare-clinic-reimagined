import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { normalizeAssetFileName, decodeMediaUpload } from "./clinicContent";
import {
  createMediaAsset,
  getAdminClinicContent,
  getPublicClinicContent,
  saveClinicProfile,
  saveService,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";

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
  imageUrl: z.string().min(1).max(2000),
  sortOrder: z.number().int().min(0).max(999),
  isPublished: z.boolean(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  clinic: router({
    publicContent: publicProcedure.query(() => getPublicClinicContent()),
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
        const buffer = decodeMediaUpload(input);
        const fileName = normalizeAssetFileName(input.fileName);
        const stored = await storagePut(`clinic/${ctx.user.id}/${fileName}`, buffer, input.mimeType);
        return createMediaAsset({
          storageKey: stored.key,
          publicUrl: stored.url,
          fileName,
          altText: input.altText,
          mimeType: input.mimeType,
          category: input.category,
          uploadedBy: ctx.user.id,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
