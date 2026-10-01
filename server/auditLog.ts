import { getDb } from "./db";
import { auditLogs } from "../drizzle/schema";

export type AuditAction =
  | "user.promote"
  | "user.demote"
  | "captcha.toggle"
  | "clinic.updateProfile"
  | "clinic.saveService"
  | "clinic.uploadMedia"
  | "appointment.updateStatus"
  | "appointment.updatePatientData"
  | "queue.add"
  | "queue.callNext"
  | "queue.complete"
  | "queue.skip"
  | "queue.reset"
  | "queue.updateSettings"
  | "signature.update";

export type AuditEntry = {
  actorId: number | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | number | null;
  detail?: string | null;
  ipAddress?: string | null;
};

/**
 * Records an admin action in the audit log.
 * Best-effort: failures are logged but never block the primary operation.
 * The `detail` field is truncated to 2 000 characters to avoid oversized rows.
 */
export async function recordAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLogs).values({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId != null ? String(entry.entityId) : null,
      detail: entry.detail ? entry.detail.slice(0, 2000) : null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      component: "audit",
      message: "Failed to record audit log",
      action: entry.action,
      error: error instanceof Error ? error.message : "Unknown",
    }));
  }
}
