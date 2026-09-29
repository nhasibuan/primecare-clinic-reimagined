/**
 * Queue domain router.
 *
 * Provides a public read endpoint for the On-Screen Display (OSD) and
 * admin operations for managing the patient queue and display settings.
 */

import {
  addQueueEntry,
  callQueueEntry,
  completeQueueEntry,
  getActiveQueueNumber,
  getOsdSettings,
  getPublicQueueEntries,
  getQueueEntries,
  resetQueue,
  skipQueueEntry,
  updateOsdSettings,
} from "../repositories/queueRepository";
import { getClientIp } from "../appointmentRequest";
import { recordAuditLog } from "../auditLog";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import {
  addQueueEntryInput,
  queueEntryIdInput,
  updateOsdSettingsInput,
} from "../schemas";

export const queueRouter = router({
  /**
   * Public: snapshot of the current queue for the waiting-room OSD display.
   * Returns entries, the active queue number and display settings.
   */
  display: publicProcedure.query(async () => {
    const [entries, activeNumber, settings] = await Promise.all([
      getPublicQueueEntries(),
      getActiveQueueNumber(),
      getOsdSettings(),
    ]);
    return { entries, activeNumber, settings };
  }),

  /** Admin: list all queue entries for today. */
  list: adminProcedure.query(() => getQueueEntries()),

  /** Admin: retrieve OSD display settings. */
  settings: adminProcedure.query(() => getOsdSettings()),

  /** Admin: add a new patient to the queue. */
  add: adminProcedure.input(addQueueEntryInput).mutation(
    async ({ ctx, input }) => {
      const result = await addQueueEntry(input);
      await recordAuditLog({
        actorId: ctx.user.id,
        action: "queue.add",
        entityType: "queue",
        entityId: result.queueNumber,
        detail: `${input.patientName} → ${input.poli}`,
        ipAddress: getClientIp(ctx.req),
      });
      return result;
    },
  ),

  /** Admin: call a patient to the consultation room. */
  callNext: adminProcedure.input(queueEntryIdInput).mutation(
    async ({ ctx, input }) => {
      const result = await callQueueEntry(input.id);
      await recordAuditLog({
        actorId: ctx.user.id,
        action: "queue.callNext",
        entityType: "queue",
        entityId: input.id,
        ipAddress: getClientIp(ctx.req),
      });
      return result;
    },
  ),

  /** Admin: mark a patient's consultation as completed. */
  complete: adminProcedure.input(queueEntryIdInput).mutation(
    async ({ ctx, input }) => {
      const result = await completeQueueEntry(input.id);
      await recordAuditLog({
        actorId: ctx.user.id,
        action: "queue.complete",
        entityType: "queue",
        entityId: input.id,
        ipAddress: getClientIp(ctx.req),
      });
      return result;
    },
  ),

  /** Admin: mark a patient's queue entry as skipped. */
  skip: adminProcedure.input(queueEntryIdInput).mutation(
    async ({ ctx, input }) => {
      const result = await skipQueueEntry(input.id);
      await recordAuditLog({
        actorId: ctx.user.id,
        action: "queue.skip",
        entityType: "queue",
        entityId: input.id,
        ipAddress: getClientIp(ctx.req),
      });
      return result;
    },
  ),

  /** Admin: reset (delete) all queue entries for today. */
  reset: adminProcedure.mutation(async ({ ctx }) => {
    const result = await resetQueue();
    await recordAuditLog({
      actorId: ctx.user.id,
      action: "queue.reset",
      entityType: "queue",
      ipAddress: getClientIp(ctx.req),
    });
    return result;
  }),

  /** Admin: update the OSD running text and/or YouTube embed URL. */
  updateSettings: adminProcedure.input(updateOsdSettingsInput).mutation(
    async ({ ctx, input }) => {
      const result = await updateOsdSettings(input);
      await recordAuditLog({
        actorId: ctx.user.id,
        action: "queue.updateSettings",
        entityType: "osd",
        ipAddress: getClientIp(ctx.req),
      });
      return result;
    },
  ),
});
