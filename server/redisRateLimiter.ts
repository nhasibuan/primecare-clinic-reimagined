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
 * Degradation policy: when Redis is unreachable or a command fails, the
 * limiter fails OPEN by default (availability first — the clinic booking form
 * must keep working) and logs a rate-limited warning. Pass `failOpen: false`
 * for a fail-closed posture. The choice is explicit at the call site, never
 * silent.
 */

import { randomBytes } from "crypto";
import type { RateLimitResult, RateLimiter, RateLimiterConfig } from "./rateLimiter";

/**
 * Structural subset of the ioredis API used by this limiter. Keeping the
 * type structural means tests can pass a lightweight fake and alternative
 * Redis clients remain swappable.
 */
export interface RedisLike {
  zadd(key: string, score: number, member: string): Promise<unknown>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<unknown>;
  zcard(key: string): Promise<number>;
  zrange(key: string, start: number, stop: number, withScores: "WITHSCORES"): Promise<string[]>;
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
  /** When Redis errors occur: true → allow the request (default), false → deny. */
  failOpen?: boolean;
};

export class RedisRateLimiter implements RateLimiter {
  private readonly redis: RedisLike;
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly failOpen: boolean;
  private readonly namespace: string;
  /** Redis set of this limiter's active window keys (for reset + activeKeyCount). */
  private readonly indexKey: string;
  /** Cached key count refreshed opportunistically — the interface is sync. */
  private lastKnownKeyCount = 0;
  private nextDegradedLogAt = 0;

  constructor(redis: RedisLike, config: RateLimiterConfig, options: RedisRateLimiterOptions) {
    if (config.maxRequests <= 0) throw new Error("maxRequests must be > 0");
    if (config.windowMs <= 0) throw new Error("windowMs must be > 0");
    if (!options.namespace) throw new Error("namespace is required");
    this.redis = redis;
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.failOpen = options.failOpen ?? true;
    this.namespace = options.namespace;
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
        return { allowed: false, retryAfterMs: Math.max(0, oldest + this.windowMs - now) };
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
      return this.failOpen
        ? { allowed: true, retryAfterMs: 0 }
        : { allowed: false, retryAfterMs: this.windowMs };
    }
  }

  /** Best-effort synchronous reset; resolves asynchronously in the background. */
  reset(): void {
    void (async () => {
      const keys = await this.redis.smembers(this.indexKey);
      if (keys.length > 0) await this.redis.del(...keys);
      await this.redis.del(this.indexKey);
      this.lastKnownKeyCount = 0;
    })().catch((error) => this.logDegraded(error));
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
      .then((n) => { this.lastKnownKeyCount = n; })
      .catch(() => { /* metric only — never surface */ });
  }

  /** Cooldown-throttled warning so a Redis outage doesn't flood the logs. */
  private logDegraded(error: unknown): void {
    const now = Date.now();
    if (now < this.nextDegradedLogAt) return;
    this.nextDegradedLogAt = now + 30_000;
    console.warn(JSON.stringify({
      timestamp: new Date(now).toISOString(),
      level: "warn",
      component: "rateLimiter",
      message: `Redis rate limiter degraded (namespace=${this.namespace}); failing ${this.failOpen ? "open" : "closed"}.`,
      error: error instanceof Error ? error.message : "Unknown",
    }));
  }
}
