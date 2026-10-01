/**
 * Pluggable rate limiter interface.
 *
 * The default InMemoryRateLimiter keeps per-key event logs in process memory
 * (fast, single-process, no external dependency). State is lost on restart and
 * is not shared across instances — for horizontal scaling, implement this
 * interface with a distributed store (e.g. Redis sorted sets: ZADD the event
 * timestamp, ZREMRANGEBYSCORE to prune, ZCARD to count) and swap the instance
 * at the composition site. Callers require no changes.
 *
 * Available implementations:
 *   - InMemoryRateLimiter  — default; true sliding window, no external dependency
 *   - NullRateLimiter      — allows all requests; for tests and dev mode
 */
export interface RateLimiter {
  /** Check whether the key is within the allowed window. Resolves fast for the in-memory implementation. */
  attempt(key: string, now?: number): Promise<RateLimitResult>;
  /** Clear all tracked state (useful in tests). Best-effort for distributed implementations. */
  reset(): void;
  /** Number of keys currently tracked. Approximate (cached) for distributed implementations. */
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

/** Timestamps of accepted attempts for one key, in ascending order. */
type Entry = number[];

/**
 * In-memory sliding-window rate limiter.
 *
 * Unlike a fixed-window counter (which permits a 2× burst across a window
 * boundary), this counts every accepted attempt within the trailing
 * `windowMs`, so the limit is enforced continuously.
 *
 * Memory is bounded in two ways:
 *   - per-key: only attempts inside the current window are retained
 *   - global: at most `maxKeys` keys; the least-recently-hit key is evicted
 *
 * Suitable for single-process deployments. State is lost on restart.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly entries = new Map<string, Entry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;

  constructor(config: RateLimiterConfig) {
    if (config.maxRequests <= 0) throw new Error("maxRequests must be > 0");
    if (config.windowMs <= 0) throw new Error("windowMs must be > 0");
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.maxKeys = config.maxKeys ?? 10_000;
  }

  async attempt(key: string, now = Date.now()): Promise<RateLimitResult> {
    this.pruneExpired(now);

    const k = key || "unknown";
    // Evict the least-recently-hit key before tracking a new one.
    if (!this.entries.has(k) && this.entries.size >= this.maxKeys) {
      this.evictOldest();
    }

    const timestamps = this.entries.get(k) ?? [];

    if (timestamps.length >= this.maxRequests) {
      // The oldest retained attempt determines when a slot frees up.
      const oldest = timestamps[0];
      return { allowed: false, retryAfterMs: Math.max(0, oldest + this.windowMs - now) };
    }

    timestamps.push(now);
    // Re-insert to refresh eviction order (Map.set keeps the old position).
    this.entries.delete(k);
    this.entries.set(k, timestamps);
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(): void {
    this.entries.clear();
  }

  get activeKeyCount(): number {
    return this.entries.size;
  }

  /** Removes keys whose attempts have all fallen outside the window. */
  private pruneExpired(now: number): void {
    const cutoff = now - this.windowMs;
    this.entries.forEach((timestamps, key) => {
      while (timestamps.length > 0 && timestamps[0] <= cutoff) {
        timestamps.shift();
      }
      if (timestamps.length === 0) this.entries.delete(key);
    });
  }

  private evictOldest(): void {
    // Map iterates in insertion order and every accepted attempt re-inserts
    // its key, so the first key is the least recently hit.
    const first = this.entries.keys().next().value;
    if (first !== undefined) this.entries.delete(first);
  }
}

/**
 * No-op rate limiter that always allows requests.
 *
 * Use in unit tests or development environments where rate-limiting
 * behaviour is irrelevant to the scenario under test.
 *
 * @example
 * vi.mock("../rateLimiter", () => ({ appointmentSubmissionRateLimiter: new NullRateLimiter() }));
 */
export class NullRateLimiter implements RateLimiter {
  readonly activeKeyCount = 0;
  async attempt(_key: string): Promise<RateLimitResult> { return { allowed: true, retryAfterMs: 0 }; }
  reset(): void { /* no-op */ }
}
