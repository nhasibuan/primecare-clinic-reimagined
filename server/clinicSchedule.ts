// Server-side clinic schedule utilities
// Re-exports the shared schedule constants and provides time-parsing helpers

import {
  CLINIC_SCHEDULE,
  INDONESIAN_DAYS,
  HOURS_12H,
  to24Hour,
  parseTimeToMinutes,
  getScheduleStatus,
} from "../shared/clinicSchedule";

export {
  CLINIC_SCHEDULE,
  INDONESIAN_DAYS,
  HOURS_12H,
  to24Hour,
  parseTimeToMinutes,
  getScheduleStatus,
};
