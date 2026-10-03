/**
 * Rate limiter composition root.
 *
 * Selects the implementation once per process:
 *   - REDIS_URL set   → RedisRateLimiter (shared sliding-window state across instances)
 *   - REDIS_URL unset → InMemoryRateLimiter (single-process default)
 *
 * Returns a synchronous delegating wrapper so call sites and tests keep a
 * stable, immediately-usable `RateLimiter`. The wrapper starts on the
 * in-memory implementation and upgrades to the Redis-backed one once the
 * client connects — a request or two during startup may be counted by the
 * temporary in-memory limiter, which is harmless.
 */

import { ENV } from "./_core/env";
import type { RedisLike } from "./redisRateLimiter";
import {
  recordLimiterDegradation,
  registerLimiter,
  setLimiterBackend,
} from "./rateLimiterMetrics";
import {
  InMemoryRateLimiter,
  type RateLimiter,
  type RateLimiterConfig,
  type RateLimitResult,
} from "./rateLimiter";

class DelegatingRateLimiter implements RateLimiter {
  private inner: RateLimiter;

  constructor(fallback: RateLimiter) {
    this.inner = fallback;
  }

  /** Swaps the delegate once the real implementation is ready. */
  upgradeTo(limiter: RateLimiter): void {
    this.inner = limiter;
  }

  attempt(key: string, now?: number): Promise<RateLimitResult> {
    return this.inner.attempt(key, now);
  }

  reset(): void {
    this.inner.reset();
  }

  get activeKeyCount(): number {
    return this.inner.activeKeyCount;
  }
}

export function createRateLimiter(
  config: RateLimiterConfig,
  name: string
): RateLimiter {
  registerLimiter(name);
  const wrapper = new DelegatingRateLimiter(new InMemoryRateLimiter(config));

  if (!ENV.redisUrl) {
    return wrapper;
  }

  void (async () => {
    try {
      const [{ default: Redis }, { RedisRateLimiter }] = await Promise.all([
        import("ioredis"),
        import("./redisRateLimiter"),
      ]);
      const client = new Redis(ENV.redisUrl, {
        maxRetriesPerRequest: 1,
        commandTimeout: 500,
      });
      // The limiter logs command failures itself (cooldown-throttled); this
      // handler only prevents an unhandled Redis 'error' event from crashing
      // the process during reconnects.
      client.on("error", () => {});
      // ioredis's overloaded zrange signatures don't fit the structural
      // RedisLike contract at the type level; at runtime the commands used
      // here (zadd/zcard/zrange WITHSCORES/pexpire) match exactly.
      wrapper.upgradeTo(
        new RedisRateLimiter(client as unknown as RedisLike, config, {
          namespace: name,
          failOpen: true,
          // Observer: every fail-open/fail-closed event is counted in the
          // metrics registry (the log line stays cooldown-throttled).
          onDegraded: () => recordLimiterDegradation(name),
        })
      );
      setLimiterBackend(name, "redis");
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          component: "rateLimiter",
          message: `Distributed rate limiting enabled via REDIS_URL (limiter=${name}).`,
        })
      );
    } catch (error) {
      // REDIS_URL is set but Redis never became usable: the limiter keeps
      // running on the in-memory implementation, flagged as degraded.
      recordLimiterDegradation(name);
      console.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warn",
          component: "rateLimiter",
          message: `REDIS_URL is set but the Redis limiter could not be initialised; keeping in-memory rate limiting (limiter=${name}).`,
          error: error instanceof Error ? error.message : "Unknown",
        })
      );
    }
  })();

  return wrapper;
}
