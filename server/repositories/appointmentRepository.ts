import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { appointmentRequests, whatsappFollowUpActivities } from "../../drizzle/schema";
import { getDb, requireDb } from "../db";

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
  return request || null;
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
  return request || null;
}

export async function createWhatsAppFollowUpActivity(input: WhatsAppFollowUpActivityInput) {
  const db = requireDb(await getDb());
  const [request] = await db.select({ id: appointmentRequests.id }).from(appointmentRequests).where(eq(appointmentRequests.id, input.appointmentRequestId)).limit(1);
  if (!request) throw new Error("Permintaan kunjungan tidak ditemukan.");
  const inserted = await db.insert(whatsappFollowUpActivities).values(input);
  const [activity] = await db.select().from(whatsappFollowUpActivities).where(eq(whatsappFollowUpActivities.id, Number(inserted[0].insertId))).limit(1);
  if (!activity) throw new Error("Gagal merekam aktivitas tindak lanjut WhatsApp.");
  return activity;
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
