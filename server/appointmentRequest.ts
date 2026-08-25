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

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
};

/**
 * Uses Express's resolved `req.ip`, which respects the app's trusted-proxy
 * setting. The address is held only in process memory for the active window
 * and is never saved with appointment data.
 */
export function getClientIp(request: RequestIpSource): string {
  const ip = request.ip?.trim() || request.socket?.remoteAddress?.trim();
  return ip || "unknown";
}

export class AppointmentSubmissionRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly maxRequests = APPOINTMENT_RATE_LIMIT_MAX_REQUESTS,
    private readonly windowMs = APPOINTMENT_RATE_LIMIT_WINDOW_MS,
    private readonly maxEntries = 10_000,
  ) {}

  attempt(clientIp: string, now = Date.now()): RateLimitResult {
    this.pruneExpired(now);
    const key = clientIp || "unknown";
    const existing = this.entries.get(key);

    if (!existing || now - existing.windowStartedAt >= this.windowMs) {
      if (!existing && this.entries.size >= this.maxEntries) this.evictOldestEntry();
      this.entries.set(key, { count: 1, windowStartedAt: now });
      return { allowed: true, retryAfterMs: 0 };
    }

    const retryAfterMs = Math.max(0, this.windowMs - (now - existing.windowStartedAt));
    if (existing.count >= this.maxRequests) {
      return { allowed: false, retryAfterMs };
    }

    existing.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  reset() {
    this.entries.clear();
  }

  get activeClientCount() {
    return this.entries.size;
  }

  private pruneExpired(now: number) {
    const expiredClientIps = Array.from(this.entries.entries())
      .filter(([, entry]) => now - entry.windowStartedAt >= this.windowMs)
      .map(([clientIp]) => clientIp);
    expiredClientIps.forEach(clientIp => this.entries.delete(clientIp));
  }

  private evictOldestEntry() {
    const oldest = this.entries.keys().next().value;
    if (oldest) this.entries.delete(oldest);
  }
}

// Per-process protection for the only public write endpoint. On autoscaling
// deployments each instance enforces its own short window without persisting IPs.
export const appointmentSubmissionRateLimiter = new AppointmentSubmissionRateLimiter();
