// Server-side clinic schedule utilities
// Re-exports the shared schedule constants and provides time-parsing helpers

import { CLINIC_SCHEDULE, INDONESIAN_DAYS, HOURS_12H } from "../shared/clinicSchedule";

export { CLINIC_SCHEDULE, INDONESIAN_DAYS, HOURS_12H };

export function to24Hour(hour12: string, period: "AM" | "PM"): string {
  const h = parseInt(hour12, 10);
  if (period === "AM") return h === 12 ? "00" : String(h).padStart(2, "0");
  return h === 12 ? "12" : String(h + 12).padStart(2, "0");
}

export function parseTimeToMinutes(hour24: string, minute: string): number {
  return parseInt(hour24, 10) * 60 + parseInt(minute, 10);
}

export function getScheduleStatus(
  service: string,
  dateStr: string,
  hour12: string,
  minute: string,
  period: "AM" | "PM",
): { valid: boolean; open?: { start: string; end: string; note?: string }; dayName?: string; message?: string } {
  if (!service || !dateStr || !hour12 || !minute || !period) {
    return { valid: false, message: "Pilih layanan, tanggal, dan jam terlebih dahulu." };
  }

  const schedule = CLINIC_SCHEDULE[service];
  if (!schedule) {
    return { valid: false, message: "Jadwal untuk layanan ini belum tersedia." };
  }

  const date = new Date(dateStr + "T12:00:00");
  const dayName = INDONESIAN_DAYS[date.getDay()];
  const daySchedule = schedule[dayName];

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
