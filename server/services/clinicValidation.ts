import { CLINIC_SCHEDULE, INDONESIAN_DAYS } from "../../shared/clinicSchedule";
import { to24Hour, parseTimeToMinutes } from "../clinicSchedule";

export type TimeValidationResult = {
  valid: boolean;
  message?: string;
  dayName?: string;
  open?: { start: string; end: string; note?: string };
};

export function validateAppointmentTime(
  service: string,
  dateStr: string,
  hour12: string,
  minute: string,
  period: "AM" | "PM",
): TimeValidationResult {
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

  if (selectedMinutes < openMinutes || selectedMinutes >= closeMinutes) {
    return {
      valid: false,
      open: daySchedule,
      dayName,
      message: `Jam tidak tersedia. ${service} buka ${daySchedule.start}–${daySchedule.end} ${dayName}.`,
    };
  }

  return { valid: true, open: daySchedule, dayName };
}
