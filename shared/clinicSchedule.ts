/**
 * Single source of truth for clinic operating hours.
 * Imported by server/clinicSchedule.ts (validation + tRPC endpoint)
 * and client/src/components/clinicSchedule.ts (form UI).
 */

export type ClinicScheduleMap = Record<string, Record<string, { start: string; end: string; note?: string }>>;

export const CLINIC_SCHEDULE: ClinicScheduleMap = {
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

export const INDONESIAN_DAYS: Record<number, string> = {
  0: "Minggu",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
};

export const HOURS_12H = ["12", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"];
