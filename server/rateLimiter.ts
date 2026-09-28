/**
 * Pluggable rate limiter interface.
 *
 * The default InMemoryRateLimiter stores state in a Map (fast, single-process).
 * For multi-instance deployments, swap in a Redis-backed implementation
 * that implements this same interface.
 */
export interface RateLimiter {
  /** Check whether the key is within the allowed window. */
  attempt(key: string, now?: number): RateLimitResult;
  /** Clear all tracked state (useful in tests). */
  reset(): void;
  /** Number of keys currently tracked. */
  readonly activeKeyCount: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export interface RateLimiterConfig {
  /** Maximum number of requests per window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Maximum number of keys before eviction (prevents memory exhaustion). */
  maxKeys?: number;
}

type Entry = { count: number; windowStartedAt: number };

/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for single-process deployments. State is lost on restart.
 * For persistence across restarts or multi-instance coordination,
 * implement the RateLimiter interface with a Redis store.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly entries = new Map<string, Entry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.maxKeys = config.maxKeys ?? 10_000;
  }

  attempt(key: string, now = Date.now()): RateLimitResult {
    this.pruneExpired(now);
    const k = key || "unknown";
    const existing = this.entries.get(k);

    if (!existing || now - existing.windowStartedAt >= this.windowMs) {
      if (!existing && this.entries.size >= this.maxKeys) this.evictOldest();
      this.entries.set(k, { count: 1, windowStartedAt: now });
      return { allowed: true, retryAfterMs: 0 };
    }

    const retryAfterMs = Math.max(0, this.windowMs - (now - existing.windowStartedAt));
    if (existing.count >= this.maxRequests) {
      return { allowed: false, retryAfterMs };
    }

    existing.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(): void {
    this.entries.clear();
  }

  get activeKeyCount(): number {
    return this.entries.size;
  }

  private pruneExpired(now: number): void {
    const expired = Array.from(this.entries.entries())
      .filter(([, entry]) => now - entry.windowStartedAt >= this.windowMs)
      .map(([key]) => key);
    expired.forEach(key => this.entries.delete(key));
  }

  private evictOldest(): void {
    const first = this.entries.keys().next().value;
    if (first !== undefined) this.entries.delete(first);
  }
}
