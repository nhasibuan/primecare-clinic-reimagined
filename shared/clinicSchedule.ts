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

export function to24Hour(hour12: string, period: "AM" | "PM"): string {
  const h = parseInt(hour12, 10);
  if (period === "AM") return h === 12 ? "00" : String(h).padStart(2, "0");
  return h === 12 ? "12" : String(h + 12).padStart(2, "0");
}

export function parseTimeToMinutes(hour24: string, minute: string): number {
  return parseInt(hour24, 10) * 60 + parseInt(minute, 10);
}

export function getScheduleStatus(
  scheduleOrService: string | Record<string, Record<string, { start: string; end: string; note?: string }>>,
  dateStrOrService: string,
  hour12OrDateStr: string,
  minuteOrHour12: string,
  periodOrMinute: "AM" | "PM" | string,
  periodArg?: "AM" | "PM",
): { valid: boolean; open?: { start: string; end: string; note?: string }; dayName?: string; message?: string } {
  let scheduleMap: Record<string, Record<string, { start: string; end: string; note?: string }>> = CLINIC_SCHEDULE;
  let service = "";
  let dateStr = "";
  let hour12 = "";
  let minute = "";
  let period: "AM" | "PM" = "AM";

  if (typeof scheduleOrService !== "string") {
    scheduleMap = scheduleOrService;
    service = dateStrOrService;
    dateStr = hour12OrDateStr;
    hour12 = minuteOrHour12;
    minute = periodOrMinute as string;
    period = periodArg as "AM" | "PM";
  } else {
    service = scheduleOrService;
    dateStr = dateStrOrService;
    hour12 = hour12OrDateStr;
    minute = minuteOrHour12;
    period = periodOrMinute as "AM" | "PM";
  }

  if (!service || !dateStr || !hour12 || !minute || !period) {
    return { valid: false, message: "Pilih layanan, tanggal, dan jam terlebih dahulu." };
  }

  const dayScheduleMap = scheduleMap[service];
  if (!dayScheduleMap) {
    return { valid: false, message: "Jadwal untuk layanan ini belum tersedia." };
  }

  const date = new Date(dateStr + "T12:00:00");
  const dayName = INDONESIAN_DAYS[date.getDay()];
  const daySchedule = dayScheduleMap[dayName];

  if (!daySchedule) {
    return { valid: false, dayName, message: `${dayName} tidak ada janji temu untuk ${service}.` };
  }

  const hour24 = to24Hour(hour12, period);
  const selectedMinutes = parseTimeToMinutes(hour24, minute);
  const openMinutes = parseTimeToMinutes(
    daySchedule.start.split(":")[0],
    daySchedule.start.split(":")[1] || "00",
  );
  const closeMinutes = parseTimeToMinutes(
    daySchedule.end.split(":")[0],
    daySchedule.end.split(":")[1] || "00",
  );

  const withinRange = selectedMinutes >= openMinutes && selectedMinutes < closeMinutes;

  if (!withinRange) {
    return {
      valid: false,
      open: daySchedule,
      dayName,
      message: `Jam tidak tersedia. ${service} buka ${daySchedule.start}–${daySchedule.end} ${dayName}.`,
    };
  }

  return { valid: true, open: daySchedule, dayName };
}
