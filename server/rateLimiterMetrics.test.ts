/**
 * Tests for the rate limiter observability registry and the degradation
 * observer hook on RedisRateLimiter.
 *
 * Verifies (without a live Redis):
 *   - the registry tracks backend, degradation count, and timestamps;
 *   - RedisRateLimiter notifies its onDegraded observer on every Redis
 *     failure (fail-open and fail-closed), and never on success;
 *   - a throwing observer cannot break rate limiting.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetLimiterMetrics,
  getLimiterStats,
  recordLimiterDegradation,
  registerLimiter,
  setLimiterBackend,
} from "./rateLimiterMetrics";
import { RedisRateLimiter, type RedisLike } from "./redisRateLimiter";

/** RedisLike whose every command throws (simulates a dead Redis). */
function deadRedis(): RedisLike {
  const boom = async (): Promise<never> => {
    throw new Error("Connection refused");
  };
  return {
    zadd: boom,
    zremrangebyscore: boom,
    zcard: boom,
    zrange: boom,
    pexpire: boom,
    sadd: boom,
    srem: boom,
    scard: boom,
    smembers: boom,
    del: boom,
  };
}

/** RedisLike that succeeds with an empty window (allows the request). */
function healthyRedis(): RedisLike {
  return {
    zadd: async () => 1,
    zremrangebyscore: async () => 0,
    zcard: async () => 0,
    zrange: async () => [],
    pexpire: async () => 1,
    sadd: async () => 1,
    srem: async () => 1,
    scard: async () => 0,
    smembers: async () => [],
    del: async () => 1,
  };
}

const config = { maxRequests: 3, windowMs: 60_000 };

beforeEach(() => {
  _resetLimiterMetrics();
});

describe("rateLimiterMetrics registry", () => {
  it("registers a limiter with the in-memory backend and zero degradations", () => {
    registerLimiter("appointments:create");
    expect(getLimiterStats()).toEqual([
      {
        name: "appointments:create",
        backend: "memory",
        degraded: false,
        degradationCount: 0,
        lastDegradationAt: null,
      },
    ]);
  });

  it("is idempotent — re-registering keeps existing stats", () => {
    registerLimiter("q");
    recordLimiterDegradation("q");
    registerLimiter("q");
    const [stats] = getLimiterStats();
    expect(stats.degradationCount).toBe(1);
    expect(stats.degraded).toBe(true);
  });

  it("counts every degradation and stamps the last one", () => {
    recordLimiterDegradation("q");
    recordLimiterDegradation("q");
    const [stats] = getLimiterStats();
    expect(stats.degradationCount).toBe(2);
    expect(stats.degraded).toBe(true);
    expect(typeof stats.lastDegradationAt).toBe("string");
  });

  it("clears the degraded flag on backend upgrade but keeps history", () => {
    recordLimiterDegradation("q");
    setLimiterBackend("q", "redis");
    const [stats] = getLimiterStats();
    expect(stats.backend).toBe("redis");
    expect(stats.degraded).toBe(false);
    expect(stats.degradationCount).toBe(1);
  });

  it("snapshots all registered limiters", () => {
    registerLimiter("a");
    registerLimiter("b");
    expect(
      getLimiterStats()
        .map(s => s.name)
        .sort()
    ).toEqual(["a", "b"]);
  });
});

describe("RedisRateLimiter onDegraded observer", () => {
  it("notifies on every Redis failure when failing open", async () => {
    const onDegraded = vi.fn();
    const limiter = new RedisRateLimiter(deadRedis(), config, {
      namespace: "obs-open",
      failOpen: true,
      onDegraded,
    });
    const r1 = await limiter.attempt("k");
    const r2 = await limiter.attempt("k");
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(onDegraded).toHaveBeenCalledTimes(2);
  });

  it("notifies on Redis failure when failing closed", async () => {
    const onDegraded = vi.fn();
    const limiter = new RedisRateLimiter(deadRedis(), config, {
      namespace: "obs-closed",
      failOpen: false,
      onDegraded,
    });
    const r = await limiter.attempt("k");
    expect(r.allowed).toBe(false);
    expect(onDegraded).toHaveBeenCalledTimes(1);
  });

  it("does not notify when Redis is healthy", async () => {
    const onDegraded = vi.fn();
    const limiter = new RedisRateLimiter(healthyRedis(), config, {
      namespace: "obs-healthy",
      onDegraded,
    });
    const r = await limiter.attempt("k");
    expect(r.allowed).toBe(true);
    expect(onDegraded).not.toHaveBeenCalled();
  });

  it("survives a throwing observer", async () => {
    const limiter = new RedisRateLimiter(deadRedis(), config, {
      namespace: "obs-throw",
      failOpen: true,
      onDegraded: () => {
        throw new Error("observer blew up");
      },
    });
    const r = await limiter.attempt("k");
    expect(r.allowed).toBe(true);
  });

  it("is optional — no observer, no problem", async () => {
    const limiter = new RedisRateLimiter(deadRedis(), config, {
      namespace: "obs-none",
    });
    const r = await limiter.attempt("k");
    expect(r.allowed).toBe(true);
  });
});
