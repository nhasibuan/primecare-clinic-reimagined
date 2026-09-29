import { and, asc, desc, eq } from "drizzle-orm";
import { queueEntries, osdSettings } from "../../drizzle/schema";
import { getDb, requireDb } from "../db";
import { getTodayDateString, redactName } from "../utils/queueUtils";

export async function getQueueEntries(date?: string) {
  const db = requireDb(await getDb());
  const targetDate = date ?? getTodayDateString();
  return db.select().from(queueEntries)
    .where(eq(queueEntries.queueDate, targetDate))
    .orderBy(asc(queueEntries.queueNumber));
}

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

  if (input.appointmentRequestId) {
    const [existing] = await db.select({ id: queueEntries.id, queueNumber: queueEntries.queueNumber })
      .from(queueEntries)
      .where(eq(queueEntries.appointmentRequestId, input.appointmentRequestId))
      .limit(1);
    if (existing) {
      return { queueNumber: existing.queueNumber, duplicate: true };
    }
  }

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

export async function getOsdSettings() {
  const db = requireDb(await getDb());
  const [settings] = await db.select().from(osdSettings).limit(1);
  if (!settings) {
    await db.insert(osdSettings).values({
      runningText: "Selamat datang di Klinik Berkat Insani. Mohon menunggu hingga nomor antrean Anda dipanggil.",
      youtubeUrl: "",
    });
    const [created] = await db.select().from(osdSettings).limit(1);
    if (!created) throw new Error("Gagal membuat pengaturan OSD.");
    return created;
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
