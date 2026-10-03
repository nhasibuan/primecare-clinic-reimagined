// Clinic schedule validation utilities
// Used by the appointment request dialog to validate time choices against clinic hours

import {
  CLINIC_SCHEDULE,
  INDONESIAN_DAYS,
  HOURS_12H,
  to24Hour,
  parseTimeToMinutes,
  getScheduleStatus,
} from "../../../shared/clinicSchedule";

export {
  CLINIC_SCHEDULE,
  INDONESIAN_DAYS,
  HOURS_12H,
  to24Hour,
  parseTimeToMinutes,
  getScheduleStatus,
};

export const MINUTES = ["00", "15", "30", "45"];

export type ScheduleValidationResult = ReturnType<typeof getScheduleStatus>;
