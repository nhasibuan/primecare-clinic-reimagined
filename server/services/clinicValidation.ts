import { CLINIC_SCHEDULE, INDONESIAN_DAYS } from "../../shared/clinicSchedule";
import { to24Hour, parseTimeToMinutes } from "../clinicSchedule";
import { err, ok, type Result } from "../../shared/result";

export type TimeValidationError = {
  /** Machine-readable failure class — keeps call sites from string-matching. */
  code: "missing_input" | "unknown_service" | "closed_day" | "outside_hours";
  /** Human-facing Indonesian message, safe to show to the patient. */
  message: string;
  /** Indonesian day name the appointment fell on, when determinable. */
  dayName?: string;
  /** Operating hours for the day, when the day itself is open. */
  open?: { start: string; end: string; note?: string };
};

export type TimeValidationResult = Result<
  { dayName: string; open: { start: string; end: string; note?: string } },
  TimeValidationError
>;

/**
 * Validates that the requested service/date/time falls within the clinic's
 * published schedule. Pure business logic — throws nothing, returns a Result.
 * Convert to a tRPC error at the router boundary with
 * {@link toAppointmentSchedulingError} / `unwrapOrThrow`.
 */
export function validateAppointmentTime(
  service: string,
  dateStr: string,
  hour12: string,
  minute: string,
  period: "AM" | "PM"
): TimeValidationResult {
  if (!service || !dateStr || !hour12 || !minute || !period) {
    return err({
      code: "missing_input",
      message: "Pilih layanan, tanggal, dan jam terlebih dahulu.",
    });
  }

  const schedule = CLINIC_SCHEDULE[service];
  if (!schedule) {
    return err({
      code: "unknown_service",
      message: "Jadwal untuk layanan ini belum tersedia.",
    });
  }

  const date = new Date(dateStr + "T12:00:00");
  const dayName = INDONESIAN_DAYS[date.getDay()];
  const daySchedule = schedule[dayName];

  if (!daySchedule) {
    return err({
      code: "closed_day",
      message: `${dayName} tidak ada janji temu untuk ${service}.`,
      dayName,
    });
  }

  const hour24 = to24Hour(hour12, period);
  const selectedMinutes = parseTimeToMinutes(hour24, minute);
  const openMinutes = parseTimeToMinutes(
    daySchedule.start.split(":")[0],
    daySchedule.start.split(":")[1] || "00"
  );
  const closeMinutes = parseTimeToMinutes(
    daySchedule.end.split(":")[0],
    daySchedule.end.split(":")[1] || "00"
  );

  if (selectedMinutes < openMinutes || selectedMinutes >= closeMinutes) {
    return err({
      code: "outside_hours",
      open: daySchedule,
      dayName,
      message: `Jam tidak tersedia. ${service} buka ${daySchedule.start}–${daySchedule.end} ${dayName}.`,
    });
  }

  return ok({ dayName, open: daySchedule });
}
