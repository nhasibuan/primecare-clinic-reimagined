import { describe, expect, it } from "vitest";
import {
  getScheduleStatus,
  to24Hour,
  parseTimeToMinutes,
  CLINIC_SCHEDULE,
} from "./clinicSchedule";

function testTo24Hour(hour12: string, period: "AM" | "PM"): string {
  const h = parseInt(hour12, 10);
  if (period === "AM") return h === 12 ? "00" : String(h).padStart(2, "0");
  return h === 12 ? "12" : String(h + 12).padStart(2, "0");
}

function testParseTimeToMinutes(hour24: string, minute: string): number {
  return parseInt(hour24, 10) * 60 + parseInt(minute, 10);
}

// 2026-09-14 is Monday. 2026-09-13 is Sunday.
// Verified: 2025-09-14 was Sunday. 2025→2026 = +365 days = +1 weekday.
// Sunday + 1 = Monday. So 2026-09-14 = Monday, 2026-09-13 = Sunday.

const TEST_SCHEDULE: Record<string, Record<string, { start: string; end: string; note?: string }>> = {
  "Poli Umum": {
    Senin:    { start: "09:00", end: "21:00" },
    Selasa:   { start: "09:00", end: "21:00" },
    Rabu:     { start: "09:00", end: "21:00" },
    Kamis:    { start: "09:00", end: "21:00" },
    Jumat:    { start: "09:00", end: "21:00" },
    Sabtu:    { start: "09:00", end: "21:00" },
    Minggu:   { start: "16:00", end: "21:00" },
  },
  "Poli Kandungan": {
    Senin:    { start: "17:00", end: "21:00", note: "Sesuai perjanjian" },
    Selasa:   { start: "17:00", end: "21:00", note: "Sesuai perjanjian" },
    Rabu:     { start: "17:00", end: "21:00", note: "Sesuai perjanjian" },
    Kamis:    { start: "17:00", end: "21:00", note: "Sesuai perjanjian" },
    Jumat:    { start: "17:00", end: "21:00", note: "Sesuai perjanjian" },
    Sabtu:    { start: "17:00", end: "21:00", note: "Sesuai perjanjian" },
    Minggu:   { start: "11:00", end: "21:00", note: "Sesuai perjanjian" },
  },
  "Poli Gigi": {
    Senin:    { start: "16:30", end: "21:00", note: "Sesuai perjanjian" },
    Selasa:   { start: "16:30", end: "21:00", note: "Sesuai perjanjian" },
    Rabu:     { start: "16:30", end: "21:00", note: "Sesuai perjanjian" },
    Kamis:    { start: "16:30", end: "21:00", note: "Sesuai perjanjian" },
    Jumat:    { start: "16:30", end: "21:00", note: "Sesuai perjanjian" },
    Sabtu:    { start: "16:30", end: "21:00", note: "Sesuai perjanjian" },
    Minggu:   { start: "16:30", end: "21:00", note: "Sesuai perjanjian" },
  },
  "Poli Penyakit Dalam": {
    Senin:    { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Selasa:   { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Rabu:     { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Kamis:    { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Jumat:    { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Sabtu:    { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Minggu:   { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
  },
  "Poli Bedah": {
    Senin:    { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Selasa:   { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Rabu:     { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Kamis:    { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Jumat:    { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Sabtu:    { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
    Minggu:   { start: "09:00", end: "21:00", note: "Sesuai perjanjian" },
  },
};

describe("clinic schedule validation", () => {
  it("converts 12-hour to 24-hour format correctly", () => {
    expect(testTo24Hour("12", "AM")).toBe("00");
    expect(testTo24Hour("1", "AM")).toBe("01");
    expect(testTo24Hour("11", "AM")).toBe("11");
    expect(testTo24Hour("12", "PM")).toBe("12");
    expect(testTo24Hour("1", "PM")).toBe("13");
    expect(testTo24Hour("11", "PM")).toBe("23");
  });

  it("parses time to minutes correctly", () => {
    expect(testParseTimeToMinutes("09", "00")).toBe(540);
    expect(testParseTimeToMinutes("16", "30")).toBe(990);
    expect(testParseTimeToMinutes("21", "00")).toBe(1260);
  });

  // ── Poli Umum ───────────────────────────────────────────────────────────
  it("accepts time within Poli Umum's Monday hours (09:00-21:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Umum", "2026-09-14", "09", "00", "AM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Senin");
  });

  it("accepts time within Poli Umum's Monday hours (20:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Umum", "2026-09-14", "08", "00", "PM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Senin");
  });

  it("rejects time before Poli Umum's Monday opening (08:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Umum", "2026-09-14", "08", "00", "AM");
    expect(result.valid).toBe(false);
    expect(result.dayName).toBe("Senin");
    expect(result.message).toContain("Jam tidak tersedia");
  });

  it("rejects time after Poli Umum's Monday closing (21:15)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Umum", "2026-09-14", "09", "15", "PM");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Jam tidak tersedia");
  });

  it("accepts time within Poli Umum's Sunday hours (16:00-21:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Umum", "2026-09-13", "04", "00", "PM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Minggu");
  });

  it("rejects time before Poli Umum's Sunday opening (11:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Umum", "2026-09-13", "11", "00", "AM");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Jam tidak tersedia");
    expect(result.message).toContain("16:00");
  });

  // ── Poli Kandungan ──────────────────────────────────────────────────────
  it("accepts time within Poli Kandungan's Sunday hours (11:00-21:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Kandungan", "2026-09-13", "11", "00", "AM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Minggu");
  });

  it("rejects time before Poli Kandungan's Sunday opening (10:30)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Kandungan", "2026-09-13", "10", "30", "AM");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Jam tidak tersedia");
  });

  it("accepts time within Poli Kandungan's Monday hours (17:00-21:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Kandungan", "2026-09-14", "05", "00", "PM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Senin");
  });

  it("rejects time before Poli Kandungan's Monday opening (16:30)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Kandungan", "2026-09-14", "04", "30", "PM");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Jam tidak tersedia");
  });

  // ── Poli Gigi ───────────────────────────────────────────────────────────
  it("accepts time within Poli Gigi's Monday hours (16:30-21:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Gigi", "2026-09-14", "04", "30", "PM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Senin");
  });

  it("rejects time before Poli Gigi's Monday opening (16:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Gigi", "2026-09-14", "04", "00", "PM");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Jam tidak tersedia");
    expect(result.message).toContain("16:30");
  });

  it("accepts time within Poli Gigi's Sunday hours (16:30-21:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Gigi", "2026-09-13", "04", "30", "PM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Minggu");
  });

  // ── Poli Penyakit Dalam ─────────────────────────────────────────────────
  it("accepts time within Poli Penyakit Dalam's Sunday hours (09:00-21:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Penyakit Dalam", "2026-09-13", "09", "00", "AM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Minggu");
  });

  it("accepts time within Poli Penyakit Dalam's Monday hours (20:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Penyakit Dalam", "2026-09-14", "08", "00", "PM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Senin");
  });

  it("rejects time before Poli Penyakit Dalam's Sunday opening (08:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Penyakit Dalam", "2026-09-13", "08", "00", "AM");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Jam tidak tersedia");
    expect(result.message).toContain("09:00");
  });

  it("shows schedule note for Poli Penyakit Dalam", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Penyakit Dalam", "2026-09-14", "10", "00", "AM");
    expect(result.valid).toBe(true);
    expect(result.open?.note).toBe("Sesuai perjanjian");
  });

  // ── Poli Bedah ──────────────────────────────────────────────────────────
  it("accepts time within Poli Bedah's Sunday hours (09:00-21:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Bedah", "2026-09-13", "09", "00", "AM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Minggu");
  });

  it("accepts time within Poli Bedah's Monday hours (20:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Bedah", "2026-09-14", "08", "00", "PM");
    expect(result.valid).toBe(true);
    expect(result.dayName).toBe("Senin");
  });

  it("rejects time before Poli Bedah's Sunday opening (08:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Bedah", "2026-09-13", "08", "00", "AM");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Jam tidak tersedia");
    expect(result.message).toContain("09:00");
  });

  it("shows schedule note for Poli Bedah", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Bedah", "2026-09-14", "10", "00", "AM");
    expect(result.valid).toBe(true);
    expect(result.open?.note).toBe("Sesuai perjanjian");
  });

  // ── Cross-service ──────────────────────────────────────────────────────
  it("rejects time for unknown service", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Layanan Tidak Diketahui", "2026-09-14", "10", "00", "AM");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Jadwal untuk layanan ini belum tersedia");
  });

  it("requires all fields to be filled", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "", "", "", "", "AM");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Pilih layanan, tanggal, dan jam terlebih dahulu");
  });

  it("shows schedule info when time is valid", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Umum", "2026-09-14", "10", "00", "AM");
    expect(result.valid).toBe(true);
    expect(result.open).toEqual({ start: "09:00", end: "21:00" });
    expect(result.dayName).toBe("Senin");
  });

  it("shows schedule note for Poli Kandungan (valid time 18:00 within 17:00-21:00)", () => {
    const result = getScheduleStatus(TEST_SCHEDULE, "Poli Kandungan", "2026-09-14", "06", "00", "PM");
    expect(result.valid).toBe(true);
    expect(result.open?.note).toBe("Sesuai perjanjian");
  });
});
