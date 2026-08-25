import { describe, expect, it } from "vitest";
import { buildAppointmentFollowUpMessage, buildWhatsAppFollowUpUrl, normalizeWhatsAppNumber } from "../shared/appointmentFollowUp";

const request = {
  fullName: "Rani Putri",
  contactNumber: "0812-3456-7890",
  service: "Poli Kandungan",
  preferredDate: "2030-01-15",
};

describe("WhatsApp appointment follow-up", () => {
  it("normalizes an Indonesian local mobile number for a WhatsApp link", () => {
    expect(normalizeWhatsAppNumber(request.contactNumber)).toBe("6281234567890");
  });

  it("generates a data-minimized editable follow-up message", () => {
    const message = buildAppointmentFollowUpMessage(request, "Salam hangat,\nTim Klinik Berkat Insani");
    expect(message).toContain("Rani Putri");
    expect(message).toContain("Poli Kandungan");
    expect(message).toContain("15 Januari 2030");
    expect(message).toContain("Salam hangat,\nTim Klinik Berkat Insani");
    expect(buildWhatsAppFollowUpUrl(request, message)).toContain("https://wa.me/6281234567890?text=");
  });
});
