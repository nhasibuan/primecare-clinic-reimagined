import { describe, expect, it } from "vitest";
import { isAutomatedAppointmentRequest, normalizeAppointmentNote } from "./appointmentRequest";

describe("appointment request privacy helpers", () => {
  it("normalizes optional scheduling notes without retaining blank data", () => {
    expect(normalizeAppointmentNote("  Mohon   konfirmasi  jadwal. ")).toBe("Mohon konfirmasi jadwal.");
    expect(normalizeAppointmentNote("   ")).toBeNull();
  });

  it("detects a completed spam honeypot", () => {
    expect(isAutomatedAppointmentRequest("")).toBe(false);
    expect(isAutomatedAppointmentRequest("https://spam.example")).toBe(true);
  });
});
