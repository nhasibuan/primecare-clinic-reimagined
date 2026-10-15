/**
 * Redis-backed sliding-window rate limiter.
 *
 * Implements the same trailing-window semantics as InMemoryRateLimiter:
 * every accepted attempt is recorded with its timestamp in a sorted set and
 * attempts older than the window are pruned before counting, so the limit is
 * enforced continuously (no fixed-window boundary bursts).
 *
 * Commands per attempt (kept as plain commands rather than a Lua script so
 * the client is mockable and the code is easy to audit):
 *   1. ZREMRANGEBYSCORE  — drop attempts that left the window
 *   2. ZCARD             — count in-window attempts
 *   3. ZADD + PEXPIRE    — record this attempt (allowed only)
 *
 * Denied attempts are not recorded, mirroring the in-memory implementation.
 * A concurrent-race window exists between ZCARD and ZADD (a few milliseconds);
 * worst case slightly over-admits under simultaneous same-key load, which is
 * acceptable for this application's traffic profile.
 *
 * Degradation policy (three levels, checked in order when a Redis command
 * fails):
 *
 *   1. `fallback` supplied → FAIL OVER: the attempt is delegated to that
 *      limiter (in production: the process-local InMemoryRateLimiter created
 *      by the composition root). Availability is preserved AND the per-
 *      instance quota still applies, so a Redis outage cannot be used to
 *      disable rate limiting altogether — the previous behaviour, and the
 *      reason a stalled Redis used to be a cheap way to defeat the only
 *      protection in front of `appointments.create`.
 *   2. no fallback, `failOpen: true` (default) → allow the request. Correct
 *      only for callers that genuinely prefer unlimited traffic to any
 *      rejection; use it deliberately, never by accident.
 *   3. no fallback, `failOpen: false` → deny the request.
 *
 * Every degradation is logged with a cooldown and reported to `onDegraded`,
 * and the delegate that answered is never hidden from observability: the
 * factory's observer already counts each event and drives the ops email.
 */

import { randomBytes } from "crypto";
import type {
  RateLimitResult,
  RateLimiter,
  RateLimiterConfig,
} from "./rateLimiter";

/**
 * Structural subset of the ioredis API used by this limiter. Keeping the
 * type structural means tests can pass a lightweight fake and alternative
 * Redis clients remain swappable.
 */
export interface RedisLike {
  zadd(key: string, score: number, member: string): Promise<unknown>;
  zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string
  ): Promise<unknown>;
  zcard(key: string): Promise<number>;
  zrange(
    key: string,
    start: number,
    stop: number,
    withScores: "WITHSCORES"
  ): Promise<string[]>;
  pexpire(key: string, ms: number): Promise<unknown>;
  sadd(key: string, member: string): Promise<unknown>;
  srem(key: string, member: string): Promise<unknown>;
  scard(key: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
  del(...keys: string[]): Promise<unknown>;
}

export type RedisRateLimiterOptions = {
  /** Namespace for this limiter's keys (e.g. "appointments:create"). */
  namespace: string;
  /**
   * Local limiter to delegate to when Redis is unusable (fail-over). When
   * supplied it takes precedence over `failOpen`/`failOpen: false`: the
   * request is still rate limited, just per instance instead of shared.
   */
  fallback?: RateLimiter;
  /** When Redis errors occur and there is no `fallback`: true → allow the request (default), false → deny. */
  failOpen?: boolean;
  /**
   * Observer callback invoked on every degradation event (Redis command
   * failure → fail-open/fail-closed). Unlike the log line, this is NOT
   * cooldown-throttled: observers use it for counters and alerting, where
   * every event matters. Must never throw.
   */
  onDegraded?: () => void;
};

export class RedisRateLimiter implements RateLimiter {
  private readonly redis: RedisLike;
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly failOpen: boolean;
  private readonly fallback: RateLimiter | undefined;
  private readonly namespace: string;
  private readonly onDegraded: (() => void) | undefined;
  /** Redis set of this limiter's active window keys (for reset + activeKeyCount). */
  private readonly indexKey: string;
  /** Cached key count refreshed opportunistically — the interface is sync. */
  private lastKnownKeyCount = 0;
  private nextDegradedLogAt = 0;

  constructor(
    redis: RedisLike,
    config: RateLimiterConfig,
    options: RedisRateLimiterOptions
  ) {
    if (config.maxRequests <= 0) throw new Error("maxRequests must be > 0");
    if (config.windowMs <= 0) throw new Error("windowMs must be > 0");
    if (!options.namespace) throw new Error("namespace is required");
    this.redis = redis;
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.failOpen = options.failOpen ?? true;
    this.fallback = options.fallback;
    this.namespace = options.namespace;
    this.onDegraded = options.onDegraded;
    this.indexKey = `rl:${this.namespace}:__keys__`;
  }

  async attempt(key: string, now = Date.now()): Promise<RateLimitResult> {
    const k = key || "unknown";
    const windowKey = `rl:${this.namespace}:${k}`;

    try {
      await this.redis.zremrangebyscore(windowKey, "-inf", now - this.windowMs);
      const count = await this.redis.zcard(windowKey);

      if (count === 0) {
        // Empty after pruning — keep the index set in sync.
        await this.redis.srem(this.indexKey, windowKey);
      }

      if (count >= this.maxRequests) {
        const oldest = await this.oldestTimestamp(windowKey);
        return {
          allowed: false,
          retryAfterMs: Math.max(0, oldest + this.windowMs - now),
        };
      }

      const member = `${now}:${randomBytes(6).toString("hex")}`;
      await this.redis.zadd(windowKey, now, member);
      // TTL is a safety net so abandoned keys (e.g. after failover) self-heal;
      // correctness relies on the ZREMRANGEBYSCORE prune above.
      await this.redis.pexpire(windowKey, this.windowMs);
      await this.redis.sadd(this.indexKey, windowKey);
      this.refreshKeyCount();
      return { allowed: true, retryAfterMs: 0 };
    } catch (error) {
      this.logDegraded(error);
      this.notifyDegraded();
      return await this.degradeTo(key, now);
    }
  }

  /**
   * Degradation ladder (see the file header): fail over to the local limiter
   * when one is configured, otherwise honour the explicit fail-open/closed
   * posture. A fallback that itself throws must never break the request — it
   * collapses to the configured posture, exactly as if it were absent.
   */
  private async degradeTo(key: string, now: number): Promise<RateLimitResult> {
    if (this.fallback) {
      try {
        return await this.fallback.attempt(key, now);
      } catch {
        // A broken local fallback is not a reason to lose the request.
      }
    }
    return this.failOpen
      ? { allowed: true, retryAfterMs: 0 }
      : { allowed: false, retryAfterMs: this.windowMs };
  }

  /** Best-effort synchronous reset; resolves asynchronously in the background. */
  reset(): void {
    void (async () => {
      const keys = await this.redis.smembers(this.indexKey);
      if (keys.length > 0) await this.redis.del(...keys);
      await this.redis.del(this.indexKey);
      this.lastKnownKeyCount = 0;
    })().catch(error => {
      this.logDegraded(error);
      this.notifyDegraded();
    });
  }

  /**
   * Approximate: refreshed opportunistically after each allowed attempt via
   * SCARD on the namespace index. Good enough for dashboards; not a counter
   * of record.
   */
  get activeKeyCount(): number {
    return this.lastKnownKeyCount;
  }

  private async oldestTimestamp(windowKey: string): Promise<number> {
    const oldest = await this.redis.zrange(windowKey, 0, 0, "WITHSCORES");
    return oldest.length >= 2 ? Number(oldest[1]) : 0;
  }

  private refreshKeyCount(): void {
    void this.redis
      .scard(this.indexKey)
      .then(n => {
        this.lastKnownKeyCount = n;
      })
      .catch(() => {
        /* metric only — never surface */
      });
  }

  /**
   * Observer notification for degradation events. Unlike `logDegraded`, this
   * fires on every event (no cooldown) so metrics/alerting see the full
   * picture. Never throws: a broken observer must not break rate limiting.
   */
  private notifyDegraded(): void {
    try {
      this.onDegraded?.();
    } catch {
      /* observer errors are swallowed by design */
    }
  }

  /** Human-readable description of what happens while Redis is unusable. */
  private degradationPosture(): string {
    if (this.fallback) return "failing over to the local limiter";
    return `failing ${this.failOpen ? "open" : "closed"}`;
  }

  /** Cooldown-throttled warning so a Redis outage doesn't flood the logs. */
  private logDegraded(error: unknown): void {
    const now = Date.now();
    if (now < this.nextDegradedLogAt) return;
    this.nextDegradedLogAt = now + 30_000;
    console.warn(
      JSON.stringify({
        timestamp: new Date(now).toISOString(),
        level: "warn",
        component: "rateLimiter",
        message: `Redis rate limiter degraded (namespace=${this.namespace}); ${this.degradationPosture()}.`,
        error: error instanceof Error ? error.message : "Unknown",
      })
    );
  }
}
