import { and, asc, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
export { eq, and, asc, count, desc, gte, lte, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appointmentRequests,
  clinicProfiles,
  InsertUser,
  mediaAssets,
  osdSettings,
  queueEntries,
  services,
  users,
  whatsappFollowUpActivities,
  whatsappSignatureTemplates,
} from "../drizzle/schema";
export { clinicProfiles } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { CLINIC_SCHEDULE, INDONESIAN_DAYS } from "../shared/clinicSchedule";
import { to24Hour, parseTimeToMinutes } from "./clinicSchedule";

let _db: ReturnType<typeof drizzle> | null = null;
let _lastConnectionAttempt = 0;
const RECONNECT_INTERVAL_MS = 30_000; // Don't retry more than once per 30 seconds

function logDb(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const entry = { timestamp: new Date().toISOString(), level, component: "database", message, ...meta };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

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

export type AppointmentRequestInput = {
  fullName: string;
  contactNumber: string;
  service: string;
  preferredDate: string;
  preferredTime?: string | null;
  note?: string | null;
};

export type WhatsAppFollowUpActivityInput = {
  appointmentRequestId: number;
  messageStatus: "draft_copied" | "whatsapp_opened";
  finalDraftLength: number;
  recordedBy: number;
};

export type WhatsAppFollowUpActivityFilters = {
  messageStatus?: "draft_copied" | "whatsapp_opened";
  startAt?: Date;
  endAt?: Date;
};

export function resolveUserRole(
  incomingRole: InsertUser["role"],
  existingRole: "admin" | "user" | undefined,
  openId: string,
  ownerOpenId: string | undefined,
): "admin" | "user" {
  return incomingRole ?? existingRole ?? (openId === ownerOpenId ? "admin" : "user");
}

export async function getDb() {
  // If we already have a connection, return it
  if (_db) return _db;

  // If no DATABASE_URL is configured, log once and return null
  if (!process.env.DATABASE_URL) {
    logDb("error", "DATABASE_URL is not configured");
    return null;
  }

  // Throttle reconnection attempts to avoid hammering the DB
  const now = Date.now();
  if (now - _lastConnectionAttempt < RECONNECT_INTERVAL_MS) {
    logDb("warn", "Reconnection throttled", { elapsed: now - _lastConnectionAttempt });
    return null;
  }
  _lastConnectionAttempt = now;

  try {
    _db = drizzle(process.env.DATABASE_URL);
    logDb("info", "Database connection established");
  } catch (error) {
    _db = null;
    logDb("error", "Failed to create database connection", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return _db;
}

/**
 * Returns a connected database instance or throws a descriptive error.
 * Use this in admin and write endpoints where silent failure is unacceptable.
 */
export async function getDbOrFail() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is temporarily unavailable. Check DATABASE_URL and ensure the database server is running.");
  }
  return db;
}

export function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database is temporarily unavailable. Check DATABASE_URL and ensure the database server is running.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDbOrFail();

  const [existing] = await db.select({ role: users.role }).from(users).where(eq(users.openId, user.openId)).limit(1);
  const role = resolveUserRole(user.role, existing?.role, user.openId, ENV.ownerOpenId);
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date(), role };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn, role };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDbOrFail();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

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
  const allServices = await db.select().from(services).orderBy(asc(services.sortOrder));
  const assets = await db.select().from(mediaAssets).orderBy(asc(mediaAssets.uploadedAt));
  const [signatureTemplate] = await db.select().from(whatsappSignatureTemplates).limit(1);
  return { profile: profile ?? null, services: allServices, mediaAssets: assets, signatureTemplate: signatureTemplate ?? null, captchaEnabled: profile?.captchaEnabled ?? true };
}

export async function saveClinicProfile(input: ClinicProfileInput) {
  const db = requireDb(await getDb());
  const [existing] = await db.select({ id: clinicProfiles.id }).from(clinicProfiles).limit(1);
  if (existing) {
    await db.update(clinicProfiles).set({ ...input, instagramUrl: input.instagramUrl ?? null }).where(eq(clinicProfiles.id, existing.id));
  } else {
    await db.insert(clinicProfiles).values({ ...input, instagramUrl: input.instagramUrl ?? null, captchaEnabled: input.captchaEnabled ?? true });
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
    preferredTime: input.preferredTime ?? null,
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

export async function updatePatientData(id: number, data: {
  nik?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  alamatLengkap?: string;
  agama?: string;
  email?: string;
  instagramUrl?: string;
}) {
  const db = requireDb(await getDb());
  await db.update(appointmentRequests).set(data).where(eq(appointmentRequests.id, id));
  const [request] = await db.select().from(appointmentRequests).where(eq(appointmentRequests.id, id)).limit(1);
  return request;
}

export async function createWhatsAppFollowUpActivity(input: WhatsAppFollowUpActivityInput) {
  const db = requireDb(await getDb());
  const [request] = await db.select({ id: appointmentRequests.id }).from(appointmentRequests).where(eq(appointmentRequests.id, input.appointmentRequestId)).limit(1);
  if (!request) throw new Error("Permintaan kunjungan tidak ditemukan.");
  const inserted = await db.insert(whatsappFollowUpActivities).values(input);
  const [activity] = await db.select().from(whatsappFollowUpActivities).where(eq(whatsappFollowUpActivities.id, Number(inserted[0].insertId))).limit(1);
  return activity!;
}

export async function getWhatsAppFollowUpActivities(filters: WhatsAppFollowUpActivityFilters = {}) {
  const db = requireDb(await getDb());
  const conditions: SQL[] = [];
  if (filters.messageStatus) conditions.push(eq(whatsappFollowUpActivities.messageStatus, filters.messageStatus));
  if (filters.startAt) conditions.push(gte(whatsappFollowUpActivities.createdAt, filters.startAt));
  if (filters.endAt) conditions.push(lte(whatsappFollowUpActivities.createdAt, filters.endAt));

  const query = db.select().from(whatsappFollowUpActivities);
  return conditions.length
    ? query.where(and(...conditions)).orderBy(desc(whatsappFollowUpActivities.createdAt))
    : query.orderBy(desc(whatsappFollowUpActivities.createdAt));
}

export async function getCaptchaEnabled(): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  const [profile] = await db.select({ captchaEnabled: clinicProfiles.captchaEnabled }).from(clinicProfiles).limit(1);
  return profile?.captchaEnabled ?? true;
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

// ─── Admin management ───────────────────────────────────────────────

export type UserListItem = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "admin" | "user";
  lastSignedIn: Date;
};

export async function listUsers(): Promise<UserListItem[]> {
  const db = requireDb(await getDb());
  return db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(desc(users.lastSignedIn));
}

export async function getUserById(id: number) {
  const db = requireDb(await getDb());
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function countAdmins(): Promise<number> {
  const db = requireDb(await getDb());
  const [result] = await db.select({ value: count() }).from(users).where(eq(users.role, "admin"));
  return result?.value ?? 0;
}

// ─── Server-side appointment time validation ──────────────────────────────

export type TimeValidationResult = {
  valid: boolean;
  message?: string;
  dayName?: string;
  open?: { start: string; end: string; note?: string };
};

export function validateAppointmentTime(
  service: string,
  dateStr: string,
  hour12: string,
  minute: string,
  period: "AM" | "PM",
): TimeValidationResult {
  if (!service || !dateStr || !hour12 || !minute || !period) {
    return { valid: false, message: "Pilih layanan, tanggal, dan jam terlebih dahulu." };
  }

  const schedule = CLINIC_SCHEDULE[service];
  if (!schedule) {
    return { valid: false, message: "Jadwal untuk layanan ini belum tersedia." };
  }

  const date = new Date(dateStr + "T12:00:00");
  const dayName = INDONESIAN_DAYS[date.getDay()];
  const daySchedule = schedule[dayName];

  if (!daySchedule) {
    return { valid: false, dayName, message: `${dayName} tidak ada janji temu untuk ${service}.` };
  }

  const hour24 = to24Hour(hour12, period);
  const selectedMinutes = parseTimeToMinutes(hour24, minute);
  const openMinutes = parseTimeToMinutes(
    daySchedule.start.split(":")[0],
    daySchedule.start.split(":")[1] || "00",
  );
  const closeMinutes = parseTimeToMinutes(
    daySchedule.end.split(":")[0],
    daySchedule.end.split(":")[1] || "00",
  );

  if (selectedMinutes < openMinutes || selectedMinutes >= closeMinutes) {
    return {
      valid: false,
      open: daySchedule,
      dayName,
      message: `Jam tidak tersedia. ${service} buka ${daySchedule.start}–${daySchedule.end} ${dayName}.`,
    };
  }

  return { valid: true, open: daySchedule, dayName };
}

export async function promoteUser(targetUserId: number): Promise<UserListItem> {
  const db = requireDb(await getDb());
  const [user] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!user) throw new Error("Pengguna tidak ditemukan.");
  if (user.role === "admin") throw new Error("Pengguna sudah menjadi administrator.");
  await db.update(users).set({ role: "admin" }).where(eq(users.id, targetUserId));
  const [updated] = await db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, targetUserId)).limit(1);
  return updated!;
}

export async function demoteUser(targetUserId: number): Promise<UserListItem> {
  const db = requireDb(await getDb());
  const [user] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!user) throw new Error("Pengguna tidak ditemukan.");
  if (user.role !== "admin") throw new Error("Pengguna bukan administrator.");
  const adminCount = await countAdmins();
  if (adminCount <= 1) throw new Error("Tidak dapat menurunkan administrator terakhir. Tambahkan administrator lain terlebih dahulu.");
  await db.update(users).set({ role: "user" }).where(eq(users.id, targetUserId));
  const [updated] = await db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, targetUserId)).limit(1);
  return updated!;
}

// ── Queue Management ──────────────────────────────────────────────────

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function getQueueEntries(date?: string) {
  const db = requireDb(await getDb());
  const targetDate = date ?? getTodayDateString();
  return db.select().from(queueEntries)
    .where(eq(queueEntries.queueDate, targetDate))
    .orderBy(asc(queueEntries.queueNumber));
}

/** Redacts a patient name for public display: "Siti Rahayu" → "S••••". */
function redactName(fullName: string): string {
  if (!fullName || fullName.length <= 1) return fullName;
  return fullName[0] + "••••";
}

/**
 * Returns today's queue entries with patient names redacted for public display.
 * Poli and queue metadata are kept; doctor names are kept since they are
 * already public staff.
 */
export async function getPublicQueueEntries(date?: string) {
  const entries = await getQueueEntries(date);
  return entries.map(entry => ({
    ...entry,
    patientName: redactName(entry.patientName),
  }));
}

export async function getActiveQueueNumber(date?: string): Promise<number> {
  const db = requireDb(await getDb());
  const targetDate = date ?? getTodayDateString();
  const [serving] = await db.select({ queueNumber: queueEntries.queueNumber })
    .from(queueEntries)
    .where(and(eq(queueEntries.queueDate, targetDate), eq(queueEntries.status, "serving")))
    .orderBy(desc(queueEntries.queueNumber))
    .limit(1);
  if (serving) return serving.queueNumber;
  // If nobody is being served, return the next waiting number
  const [nextWaiting] = await db.select({ queueNumber: queueEntries.queueNumber })
    .from(queueEntries)
    .where(and(eq(queueEntries.queueDate, targetDate), eq(queueEntries.status, "waiting")))
    .orderBy(asc(queueEntries.queueNumber))
    .limit(1);
  return nextWaiting?.queueNumber ?? 0;
}

export async function addQueueEntry(input: { patientName: string; poli: string; doctorName: string; appointmentRequestId?: number }) {
  const db = requireDb(await getDb());
  const today = getTodayDateString();

  // Prevent duplicate queue entries for the same appointment request
  if (input.appointmentRequestId) {
    const [existing] = await db.select({ id: queueEntries.id, queueNumber: queueEntries.queueNumber })
      .from(queueEntries)
      .where(eq(queueEntries.appointmentRequestId, input.appointmentRequestId))
      .limit(1);
    if (existing) {
      return { queueNumber: existing.queueNumber, duplicate: true };
    }
  }

  // Get next queue number for today
  const [last] = await db.select({ queueNumber: queueEntries.queueNumber })
    .from(queueEntries)
    .where(eq(queueEntries.queueDate, today))
    .orderBy(desc(queueEntries.queueNumber))
    .limit(1);
  const nextNumber = (last?.queueNumber ?? 0) + 1;
  await db.insert(queueEntries).values({
    queueNumber: nextNumber,
    patientName: input.patientName,
    poli: input.poli,
    doctorName: input.doctorName,
    appointmentRequestId: input.appointmentRequestId ?? null,
    status: "waiting",
    queueDate: today,
  });
  return { queueNumber: nextNumber, duplicate: false };
}

export async function callQueueEntry(id: number) {
  const db = requireDb(await getDb());
  const [entry] = await db.select().from(queueEntries).where(eq(queueEntries.id, id)).limit(1);
  if (!entry) throw new Error("Entri antrean tidak ditemukan.");
  if (entry.status !== "waiting") throw new Error("Entri antrean sudah dipanggil atau selesai.");
  await db.update(queueEntries).set({ status: "serving" }).where(eq(queueEntries.id, id));
  return { success: true };
}

export async function completeQueueEntry(id: number) {
  const db = requireDb(await getDb());
  const [entry] = await db.select().from(queueEntries).where(eq(queueEntries.id, id)).limit(1);
  if (!entry) throw new Error("Entri antrean tidak ditemukan.");
  await db.update(queueEntries).set({ status: "done" }).where(eq(queueEntries.id, id));
  return { success: true };
}

export async function skipQueueEntry(id: number) {
  const db = requireDb(await getDb());
  const [entry] = await db.select().from(queueEntries).where(eq(queueEntries.id, id)).limit(1);
  if (!entry) throw new Error("Entri antrean tidak ditemukan.");
  await db.update(queueEntries).set({ status: "skipped" }).where(eq(queueEntries.id, id));
  return { success: true };
}

export async function resetQueue() {
  const db = requireDb(await getDb());
  const today = getTodayDateString();
  await db.delete(queueEntries).where(eq(queueEntries.queueDate, today));
  return { success: true };
}

// ── OSD Settings ──────────────────────────────────────────────────────

export async function getOsdSettings() {
  const db = requireDb(await getDb());
  const [settings] = await db.select().from(osdSettings).limit(1);
  if (!settings) {
    // Create default settings row
    await db.insert(osdSettings).values({
      runningText: "Selamat datang di Klinik Berkat Insani. Mohon menunggu hingga nomor antrean Anda dipanggil.",
      youtubeUrl: "",
    });
    const [created] = await db.select().from(osdSettings).limit(1);
    return created!;
  }
  return settings;
}

export async function updateOsdSettings(input: { runningText?: string; youtubeUrl?: string }) {
  const db = requireDb(await getDb());
  const [settings] = await db.select().from(osdSettings).limit(1);
  if (!settings) {
    await db.insert(osdSettings).values({
      runningText: input.runningText ?? "Selamat datang di Klinik Berkat Insani. Mohon menunggu hingga nomor antrean Anda dipanggil.",
      youtubeUrl: input.youtubeUrl ?? "",
    });
  } else {
    const updates: Record<string, string> = {};
    if (input.runningText !== undefined) updates.runningText = input.runningText;
    if (input.youtubeUrl !== undefined) updates.youtubeUrl = input.youtubeUrl;
    if (Object.keys(updates).length > 0) {
      await db.update(osdSettings).set(updates).where(eq(osdSettings.id, settings.id));
    }
  }
  return getOsdSettings();
}
