import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createAppointmentRequest: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, createAppointmentRequest: dbMocks.createAppointmentRequest };
});

import { appointmentSubmissionRateLimiter } from "./appointmentRequest";
import { appRouter } from "./routers";

const input = {
  fullName: "QA Rate Limit",
  contactNumber: "+6285215862526",
  service: "Poli Umum",
  preferredDate: "2026-08-26",
  consent: true as const,
};

function createContext(ip: string): TrpcContext {
  return {
    user: null,
    req: { ip, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("appointment create rate limiting", () => {
  beforeEach(() => {
    appointmentSubmissionRateLimiter.reset();
    dbMocks.createAppointmentRequest.mockReset();
    dbMocks.createAppointmentRequest.mockResolvedValue({ id: 150001 });
  });

  it("allows normal submissions but rejects rapid fourth submission from the same IP", async () => {
    const caller = appRouter.createCaller(createContext("203.0.113.42"));

    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await expect(caller.appointments.create(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(dbMocks.createAppointmentRequest).toHaveBeenCalledTimes(3);
  });

  it("keeps the honeypot short-circuit intact without consuming a rate-limit slot", async () => {
    const caller = appRouter.createCaller(createContext("198.51.100.7"));

    await expect(caller.appointments.create({ ...input, website: "https://spam.example" })).resolves.toEqual({
      success: true,
      requestId: null,
    });
    expect(dbMocks.createAppointmentRequest).not.toHaveBeenCalled();

    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await caller.appointments.create(input);
    expect(dbMocks.createAppointmentRequest).toHaveBeenCalledTimes(3);
  });
});
