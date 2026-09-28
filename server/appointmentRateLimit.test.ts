import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createAppointmentRequest: vi.fn(),
}));

const turnstileMocks = vi.hoisted(() => ({
  verifyTurnstileToken: vi.fn(),
  getTurnstileVerificationSecret: vi.fn(() => "test-secret"),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, createAppointmentRequest: dbMocks.createAppointmentRequest };
});

vi.mock("./turnstile", () => ({
  verifyTurnstileToken: turnstileMocks.verifyTurnstileToken,
  getTurnstileVerificationSecret: turnstileMocks.getTurnstileVerificationSecret,
}));

import { appointmentSubmissionRateLimiter } from "./appointmentRequest";
import { appRouter } from "./routers";

const input = {
  fullName: "QA Rate Limit",
  contactNumber: "+628123456789",
  service: "Poli Umum",
  preferredDate: "2026-08-26",
  preferredHour: "10",
  preferredMinute: "00",
  preferredPeriod: "AM" as const,
  consent: true as const,
  captchaToken: "test-captcha-token",
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
    turnstileMocks.verifyTurnstileToken.mockReset();
    turnstileMocks.verifyTurnstileToken.mockResolvedValue({ success: true, errorCodes: [] });
  });

  it("allows normal submissions but rejects rapid fourth submission from the same IP", async () => {
    const caller = appRouter.createCaller(createContext("203.0.113.42"));

    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await expect(caller.appointments.create(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(dbMocks.createAppointmentRequest).toHaveBeenCalledTimes(3);
  });

  it("rejects submission without captcha token", async () => {
    const caller = appRouter.createCaller(createContext("203.0.113.99"));
    const inputWithoutCaptcha = { ...input, captchaToken: undefined };
    await expect(caller.appointments.create(inputWithoutCaptcha)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createAppointmentRequest).not.toHaveBeenCalled();
  });

  it("rejects submission with invalid captcha token", async () => {
    turnstileMocks.verifyTurnstileToken.mockResolvedValueOnce({ success: false, errorCodes: ["invalid-input-response"] });
    const caller = appRouter.createCaller(createContext("203.0.113.100"));
    await expect(caller.appointments.create({ ...input, captchaToken: "invalid-token" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createAppointmentRequest).not.toHaveBeenCalled();
  });

  it("rate limits after captcha verification succeeds", async () => {
    const caller = appRouter.createCaller(createContext("203.0.113.88"));
    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await caller.appointments.create(input);

    // Fourth submission should be rate-limited (even with valid captcha)
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

    // Verify honeypot doesn't consume rate limit slots
    await caller.appointments.create(input);
    await caller.appointments.create(input);
    await caller.appointments.create(input);
    expect(dbMocks.createAppointmentRequest).toHaveBeenCalledTimes(3);
  });
});
