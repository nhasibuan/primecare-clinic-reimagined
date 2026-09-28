import { InMemoryRateLimiter, type RateLimiter } from "./rateLimiter";

export type { RateLimitResult } from "./rateLimiter";

export function normalizeAppointmentNote(note?: string | null) {
  const normalized = note?.trim().replace(/\s+/g, " ") ?? "";
  return normalized || null;
}

export function isAutomatedAppointmentRequest(honeypot?: string | null) {
  return Boolean(honeypot?.trim());
}

export const APPOINTMENT_RATE_LIMIT_WINDOW_MS = 60_000;
export const APPOINTMENT_RATE_LIMIT_MAX_REQUESTS = 3;

type RequestIpSource = {
  ip?: string;
  socket?: { remoteAddress?: string | undefined };
};

/**
 * Uses Express's resolved `req.ip`, which respects the app's trusted-proxy
 * setting. The address is held only in process memory for the active window
 * and is never saved with appointment data.
 *
 * Rejects obviously spoofed values that don't look like IPs.
 */
export function getClientIp(request: RequestIpSource): string {
  const raw = request.ip?.trim() || request.socket?.remoteAddress?.trim();
  if (!raw) return "unknown";
  // Basic validation: IPv4, IPv6, or IPv4-mapped IPv6.
  if (/^[\d.:a-fA-F]+$/.test(raw) && raw.length <= 45) return raw;
  return "unknown";
}

/**
 * @deprecated Use `InMemoryRateLimiter` from `./rateLimiter` directly.
 * Retained for backwards compatibility with existing tests.
 */
export class AppointmentSubmissionRateLimiter extends InMemoryRateLimiter {
  constructor(
    maxRequests = APPOINTMENT_RATE_LIMIT_MAX_REQUESTS,
    windowMs = APPOINTMENT_RATE_LIMIT_WINDOW_MS,
    maxEntries = 10_000,
  ) {
    super({ maxRequests, windowMs, maxKeys: maxEntries });
  }

  /** @deprecated Use `activeKeyCount` instead. */
  get activeClientCount() {
    return this.activeKeyCount;
  }
}

// Per-process protection for the only public write endpoint. On autoscaling
// deployments each instance enforces its own short window without persisting IPs.
export const appointmentSubmissionRateLimiter: RateLimiter = new InMemoryRateLimiter({
  maxRequests: APPOINTMENT_RATE_LIMIT_MAX_REQUESTS,
  windowMs: APPOINTMENT_RATE_LIMIT_WINDOW_MS,
});
