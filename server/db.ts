import { asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appointmentRequests,
  clinicProfiles,
  InsertUser,
  mediaAssets,
  services,
  users,
  whatsappSignatureTemplates,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export type ClinicProfileInput = {
  name: string;
  tagline: string;
  address: string;
  whatsappUrl: string;
  instagramUrl?: string | null;
};

export type ServiceInput = {
  id?: number;
  name: string;
  summary: string;
  imageUrl: string;
  sortOrder: number;
  isPublished: boolean;
};

export type AppointmentRequestInput = {
  fullName: string;
  contactNumber: string;
  service: string;
  preferredDate: string;
  note?: string | null;
};

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database is not available.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getPublicClinicContent() {
  const db = await getDb();
  if (!db) return { profile: null, services: [] };
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
  const allServices = await db.select().from(services).orderBy(asc(services.sortOrder));
  const assets = await db.select().from(mediaAssets).orderBy(asc(mediaAssets.uploadedAt));
  const [signatureTemplate] = await db.select().from(whatsappSignatureTemplates).limit(1);
  return { profile: profile ?? null, services: allServices, mediaAssets: assets, signatureTemplate: signatureTemplate ?? null };
}

export async function saveClinicProfile(input: ClinicProfileInput) {
  const db = requireDb(await getDb());
  const [existing] = await db.select({ id: clinicProfiles.id }).from(clinicProfiles).limit(1);
  if (existing) {
    await db.update(clinicProfiles).set(input).where(eq(clinicProfiles.id, existing.id));
  } else {
    await db.insert(clinicProfiles).values({ ...input, instagramUrl: input.instagramUrl ?? null });
  }
  const [profile] = await db.select().from(clinicProfiles).limit(1);
  return profile!;
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
  const result = await db.select().from(services).orderBy(asc(services.sortOrder));
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
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.storageKey, input.storageKey)).limit(1);
  return asset!;
}

export async function createAppointmentRequest(input: AppointmentRequestInput) {
  const db = requireDb(await getDb());
  const inserted = await db.insert(appointmentRequests).values({
    ...input,
    note: input.note ?? null,
    consentedAt: new Date(),
  });
  return { id: Number(inserted[0].insertId) };
}

export async function getAppointmentRequests() {
  const db = requireDb(await getDb());
  return db.select().from(appointmentRequests).orderBy(desc(appointmentRequests.createdAt));
}

export async function updateAppointmentRequestStatus(id: number, status: "new" | "contacted" | "closed") {
  const db = requireDb(await getDb());
  await db.update(appointmentRequests).set({ status }).where(eq(appointmentRequests.id, id));
  const [request] = await db.select().from(appointmentRequests).where(eq(appointmentRequests.id, id)).limit(1);
  return request;
}

export async function saveWhatsAppSignatureTemplate(content: string, updatedBy: number) {
  const db = requireDb(await getDb());
  const [existing] = await db.select({ id: whatsappSignatureTemplates.id }).from(whatsappSignatureTemplates).limit(1);
  if (existing) {
    await db.update(whatsappSignatureTemplates).set({ content, updatedBy }).where(eq(whatsappSignatureTemplates.id, existing.id));
  } else {
    await db.insert(whatsappSignatureTemplates).values({ content, updatedBy });
  }
  const [template] = await db.select().from(whatsappSignatureTemplates).limit(1);
  return template!;
}
