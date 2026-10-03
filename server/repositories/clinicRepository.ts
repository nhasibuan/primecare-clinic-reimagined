import { asc, eq } from "drizzle-orm";
import {
  clinicProfiles,
  services,
  mediaAssets,
  whatsappSignatureTemplates,
} from "../../drizzle/schema";
import { getDb, requireDb } from "../db";

export type ClinicProfileInput = {
  name: string;
  tagline: string;
  address: string;
  whatsappUrl: string;
  instagramUrl?: string | null;
  captchaEnabled?: boolean;
};

export type ServiceInput = {
  id?: number;
  name: string;
  summary: string;
  imageUrl: string;
  sortOrder: number;
  isPublished: boolean;
};

export async function getPublicClinicContent() {
  const db = await getDb();
  if (!db) throw new Error("Database is temporarily unavailable.");
  const [profile] = await db.select().from(clinicProfiles).limit(1);
  const publicServices = await db
    .select()
    .from(services)
    .where(eq(services.isPublished, true))
    .orderBy(asc(services.sortOrder));
  return { profile: profile ?? null, services: publicServices };
}

export async function getAdminClinicContent() {
  const db = requireDb(await getDb());
  const [profile] = await db.select().from(clinicProfiles).limit(1);
  const allServices = await db
    .select()
    .from(services)
    .orderBy(asc(services.sortOrder));
  const assets = await db
    .select()
    .from(mediaAssets)
    .orderBy(asc(mediaAssets.uploadedAt));
  const [signatureTemplate] = await db
    .select()
    .from(whatsappSignatureTemplates)
    .limit(1);
  return {
    profile: profile ?? null,
    services: allServices,
    mediaAssets: assets,
    signatureTemplate: signatureTemplate ?? null,
    captchaEnabled: profile?.captchaEnabled ?? true,
  };
}

export async function saveClinicProfile(input: ClinicProfileInput) {
  const db = requireDb(await getDb());
  const [existing] = await db
    .select({ id: clinicProfiles.id })
    .from(clinicProfiles)
    .limit(1);
  if (existing) {
    await db
      .update(clinicProfiles)
      .set({ ...input, instagramUrl: input.instagramUrl ?? null })
      .where(eq(clinicProfiles.id, existing.id));
  } else {
    await db
      .insert(clinicProfiles)
      .values({
        ...input,
        instagramUrl: input.instagramUrl ?? null,
        captchaEnabled: input.captchaEnabled ?? true,
      });
  }
  const [profile] = await db.select().from(clinicProfiles).limit(1);
  if (!profile) throw new Error("Gagal menyimpan profil klinik.");
  return profile;
}

export async function saveService(input: ServiceInput) {
  const db = requireDb(await getDb());
  const values = {
    name: input.name,
    summary: input.summary,
    imageUrl: input.imageUrl,
    sortOrder: input.sortOrder,
    isPublished: input.isPublished,
  };
  if (input.id) {
    await db.update(services).set(values).where(eq(services.id, input.id));
  } else {
    await db.insert(services).values(values);
  }
  const result = await db
    .select()
    .from(services)
    .orderBy(asc(services.sortOrder));
  return result;
}

export async function createMediaAsset(input: {
  storageKey: string;
  publicUrl: string;
  fileName: string;
  altText: string;
  mimeType: string;
  category: "brand" | "service" | "clinician" | "facility" | "document";
  uploadedBy: number;
}) {
  const db = requireDb(await getDb());
  await db.insert(mediaAssets).values(input);
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.storageKey, input.storageKey))
    .limit(1);
  if (!asset) throw new Error("Gagal menyimpan aset media.");
  return asset;
}

export async function getCaptchaEnabled(): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  const [profile] = await db
    .select({ captchaEnabled: clinicProfiles.captchaEnabled })
    .from(clinicProfiles)
    .limit(1);
  return profile?.captchaEnabled ?? true;
}

export async function saveWhatsAppSignatureTemplate(
  content: string,
  updatedBy: number
) {
  const db = requireDb(await getDb());
  const [existing] = await db
    .select({ id: whatsappSignatureTemplates.id })
    .from(whatsappSignatureTemplates)
    .limit(1);
  if (existing) {
    await db
      .update(whatsappSignatureTemplates)
      .set({ content, updatedBy })
      .where(eq(whatsappSignatureTemplates.id, existing.id));
  } else {
    await db.insert(whatsappSignatureTemplates).values({ content, updatedBy });
  }
  const [template] = await db
    .select()
    .from(whatsappSignatureTemplates)
    .limit(1);
  if (!template)
    throw new Error("Gagal menyimpan template tanda tangan WhatsApp.");
  return template;
}

/**
 * Enables or disables the Turnstile CAPTCHA gate for the public appointment
 * form.  Throws NOT_FOUND (via TRPCError-friendly message) when no clinic
 * profile has been created yet — callers in the admin router translate this
 * to a 404 response.
 *
 * Returns the updated `captchaEnabled` value so callers can echo it back
 * without an additional round-trip.
 */
export async function toggleCaptchaEnabled(
  enabled: boolean
): Promise<{ profileId: number; enabled: boolean }> {
  const db = requireDb(await getDb());
  const [profile] = await db
    .select({ id: clinicProfiles.id })
    .from(clinicProfiles)
    .limit(1);
  if (!profile) throw new Error("Profil klinik tidak ditemukan.");
  await db
    .update(clinicProfiles)
    .set({ captchaEnabled: enabled })
    .where(eq(clinicProfiles.id, profile.id));
  return { profileId: profile.id, enabled };
}
