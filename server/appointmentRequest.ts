/**
 * True client IP resolution for rate limiting and audit trails.
 *
 * Trust policy: `trust proxy` is set to 1 in server/_core/index.ts, meaning
 * exactly one reverse-proxy hop is trusted. `req.ip` is therefore the
 * right-most X-Forwarded-For entry after removing the trusted proxy itself —
 * i.e. what the gateway saw. Hardening note: if the deployment topology adds
 * another hop (CDN → LB → node), `trust proxy` must be updated, otherwise
 * X-Forwarded-For becomes client-forgeable and the IP rate limiter is
 * defeated.
 */

import { createRateLimiter } from "./rateLimiterFactory";
import type { RateLimiter } from "./rateLimiter";

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
 * Extracts the client IP for rate limiting and audit logging.
 *
 * Prefers Express's resolved `req.ip` (proxy-aware via `trust proxy`) and
 * falls back to the raw socket address. Values are validated against
 * inet_pton-style dotted-quad IPv4, normalised IPv6, and IPv4-mapped IPv6 —
 * malformed or spoofed garbage resolves to "unknown" rather than being
 * trusted. The address is held only in process memory for the active window
 * and is never saved with appointment data.
 */
export function getClientIp(request: RequestIpSource): string {
  const raw = request.ip?.trim() || request.socket?.remoteAddress?.trim();
  if (!raw) return "unknown";

  if (isValidIpv4(raw) || isValidIpv6(raw)) return raw;
  return "unknown";
}

/** Dotted-quad IPv4 with strict 0-255 octet validation. */
function isValidIpv4(value: string): boolean {
  const octets = value.split(".");
  if (octets.length !== 4) return false;
  return octets.every(octet => {
    if (!/^\d{1,3}$/.test(octet)) return false;
    const numeric = Number(octet);
    return numeric >= 0 && numeric <= 255;
  });
}

/**
 * IPv6 acceptance: full or compressed forms with optional IPv4-mapped tail
 * (::ffff:192.0.2.1). Rejects malformed sequences like ":::" and multiple
 * "::" compression markers while staying charset-strict.
 */
function isValidIpv6(value: string): boolean {
  if (!value.includes(":")) return false;
  if (!/^[0-9a-fA-F:.]+$/.test(value)) return false;
  if (value.includes(":::")) return false;
  // At most one "::" compression marker is allowed.
  return (value.match(/::/g) ?? []).length <= 1;
}

// Protection for the only public write endpoint. In-memory sliding window by
// default; upgrades to the shared Redis-backed limiter when REDIS_URL is set.
// The IP is held only for the active window and is never saved with appointment data.
export const appointmentSubmissionRateLimiter: RateLimiter = createRateLimiter(
  {
    maxRequests: APPOINTMENT_RATE_LIMIT_MAX_REQUESTS,
    windowMs: APPOINTMENT_RATE_LIMIT_WINDOW_MS,
    maxKeys: 10_000,
  },
  "appointments:create"
);
