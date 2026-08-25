import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createWhatsAppFollowUpActivity: vi.fn(),
  getWhatsAppFollowUpActivities: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createWhatsAppFollowUpActivity: dbMocks.createWhatsAppFollowUpActivity,
    getWhatsAppFollowUpActivities: dbMocks.getWhatsAppFollowUpActivities,
  };
});

import { appRouter } from "./routers";

function createContext(role: "admin" | "user" = "admin"): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "clinic-admin",
      name: "Clinic Admin",
      email: "admin@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("WhatsApp follow-up activity", () => {
  beforeEach(() => {
    dbMocks.createWhatsAppFollowUpActivity.mockReset();
    dbMocks.getWhatsAppFollowUpActivities.mockReset();
  });

  it("records only the final length, activity status, appointment reference, and staff actor", async () => {
    dbMocks.createWhatsAppFollowUpActivity.mockResolvedValue({ id: 1 });
    const caller = appRouter.createCaller(createContext());

    await caller.appointments.recordFollowUpActivity({
      appointmentRequestId: 17,
      messageStatus: "whatsapp_opened",
      finalDraftLength: 184,
    });

    expect(dbMocks.createWhatsAppFollowUpActivity).toHaveBeenCalledWith({
      appointmentRequestId: 17,
      messageStatus: "whatsapp_opened",
      finalDraftLength: 184,
      recordedBy: 42,
    });
  });

  it("rejects an activity length beyond the enforced WhatsApp draft limit", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.appointments.recordFollowUpActivity({
      appointmentRequestId: 17,
      messageStatus: "draft_copied",
      finalDraftLength: 1001,
    })).rejects.toThrow();
    expect(dbMocks.createWhatsAppFollowUpActivity).not.toHaveBeenCalled();
  });

  it("does not expose follow-up history to non-administrator users", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.appointments.listFollowUpActivities()).rejects.toThrow();
  });

  it("forwards validated activity status and date-range filters to the protected history query", async () => {
    dbMocks.getWhatsAppFollowUpActivities.mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext());
    const startAt = new Date("2030-01-01T00:00:00.000Z");
    const endAt = new Date("2030-01-31T23:59:59.999Z");

    await caller.appointments.listFollowUpActivities({ messageStatus: "whatsapp_opened", startAt, endAt });

    expect(dbMocks.getWhatsAppFollowUpActivities).toHaveBeenCalledWith({ messageStatus: "whatsapp_opened", startAt, endAt });
  });

  it("rejects a date range whose end precedes its start", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.appointments.listFollowUpActivities({
      startAt: new Date("2030-02-01T00:00:00.000Z"),
      endAt: new Date("2030-01-01T00:00:00.000Z"),
    })).rejects.toThrow();
    expect(dbMocks.getWhatsAppFollowUpActivities).not.toHaveBeenCalled();
  });
});
