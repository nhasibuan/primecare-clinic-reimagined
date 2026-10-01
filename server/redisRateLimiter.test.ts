/**
 * Tests for the Redis-backed sliding-window rate limiter.
 *
 * Uses an in-memory fake of the sorted-set commands so the sliding-window
 * semantics, degradation policy, and index maintenance are verified without
 * a live Redis instance.
 */

import { describe, expect, it } from "vitest";
import { RedisRateLimiter, type RedisLike } from "./redisRateLimiter";

/** Minimal sorted-set fake implementing exactly the commands the limiter uses. */
class FakeRedis implements RedisLike {
  // key -> (member -> score)
  private zsets = new Map<string, Map<string, number>>();
  // plain sets (only the index key uses this)
  private sets = new Map<string, Set<string>>();
  failNextCommand = false;

  private zset(key: string): Map<string, number> {
    let z = this.zsets.get(key);
    if (!z) {
      z = new Map();
      this.zsets.set(key, z);
    }
    return z;
  }

  private shouldFail(): boolean {
    if (this.failNextCommand) {
      this.failNextCommand = false;
      throw new Error("Connection refused");
    }
    return false;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    this.shouldFail();
    this.zset(key).set(member, score);
    return 1;
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    this.shouldFail();
    const z = this.zset(key);
    const lo = min === "-inf" ? -Infinity : Number(min);
    const hi = max === "+inf" ? Infinity : Number(max);
    let removed = 0;
    const entries = Array.from(z.entries());
    for (const [member, score] of entries) {
      if (score >= lo && score <= hi) {
        z.delete(member);
        removed += 1;
      }
    }
    return removed;
  }

  async zcard(key: string): Promise<number> {
    this.shouldFail();
    return this.zset(key).size;
  }

  async zrange(key: string, start: number, stop: number, withScores: "WITHSCORES"): Promise<string[]> {
    this.shouldFail();
    const entries = Array.from(this.zset(key).entries()).sort((a, b) => a[1] - b[1]);
    const slice = entries.slice(start, stop + 1);
    return slice.flatMap(([member, score]) => [member, String(score)]);
  }

  async pexpire(_key: string, _ms: number): Promise<number> {
    this.shouldFail();
    return 1;
  }

  async sadd(key: string, member: string): Promise<number> {
    this.shouldFail();
    let s = this.sets.get(key);
    if (!s) {
      s = new Set();
      this.sets.set(key, s);
    }
    const added = s.has(member) ? 0 : 1;
    s.add(member);
    return added;
  }

  async srem(key: string, member: string): Promise<number> {
    this.shouldFail();
    return this.sets.get(key)?.delete(member) ? 1 : 0;
  }

  async scard(key: string): Promise<number> {
    this.shouldFail();
    return this.sets.get(key)?.size ?? 0;
  }

  async smembers(key: string): Promise<string[]> {
    this.shouldFail();
    return Array.from(this.sets.get(key) ?? []);
  }

  async del(...keys: string[]): Promise<number> {
    this.shouldFail();
    let removed = 0;
    for (const key of keys) {
      if (this.zsets.delete(key) || this.sets.delete(key)) removed += 1;
    }
    return removed;
  }
}

function makeLimiter(fake: FakeRedis, failOpen = true) {
  return new RedisRateLimiter(fake, { maxRequests: 3, windowMs: 60_000 }, {
    namespace: "test",
    failOpen,
  });
}

describe("RedisRateLimiter", () => {
  it("allows up to maxRequests then denies with retryAfter derived from the oldest attempt", async () => {
    const limiter = makeLimiter(new FakeRedis());

    expect((await limiter.attempt("ip", 0)).allowed).toBe(true);
    expect((await limiter.attempt("ip", 1_000)).allowed).toBe(true);
    expect((await limiter.attempt("ip", 2_000)).allowed).toBe(true);

    const blocked = await limiter.attempt("ip", 3_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(57_000);
  });

  it("slides the window — old attempts free slots without a boundary reset", async () => {
    const limiter = makeLimiter(new FakeRedis());

    for (const t of [59_000, 59_500, 59_900]) {
      await limiter.attempt("ip", t);
    }
    expect((await limiter.attempt("ip", 60_100)).allowed).toBe(false);
    expect((await limiter.attempt("ip", 119_001)).allowed).toBe(true);
  });

  it("does not count denied attempts against the quota", async () => {
    const limiter = makeLimiter(new FakeRedis());

    for (const t of [0, 1_000, 2_000]) await limiter.attempt("ip", t);
    for (const t of [2_500, 2_600, 2_700]) {
      expect((await limiter.attempt("ip", t)).allowed).toBe(false);
    }
    // Window slides: at t=60_500 only t=0 has aged out (cutoff = 500), so
    // t=1_000 and t=2_000 still occupy two slots.
    expect((await limiter.attempt("ip", 60_500)).allowed).toBe(true);
    expect((await limiter.attempt("ip", 60_600)).allowed).toBe(false);
    // By t=119_001 the t=1_000/2_000 attempts have aged out entirely.
    expect((await limiter.attempt("ip", 119_001)).allowed).toBe(true);
  });

  it("keeps independent counters per key", async () => {
    const limiter = makeLimiter(new FakeRedis());

    for (const t of [0, 1_000, 2_000]) await limiter.attempt("ip-a", t);
    expect((await limiter.attempt("ip-b", 2_500)).allowed).toBe(true);
  });

  it("fails open by default when Redis errors", async () => {
    const fake = new FakeRedis();
    const limiter = makeLimiter(fake);
    fake.failNextCommand = true;

    const result = await limiter.attempt("ip", 0);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it("can be configured to fail closed when Redis errors", async () => {
    const fake = new FakeRedis();
    const limiter = makeLimiter(fake, false);
    fake.failNextCommand = true;

    const result = await limiter.attempt("ip", 0);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(60_000);
  });

  it("tracks active keys approximately and supports reset", async () => {
    const fake = new FakeRedis();
    const limiter = makeLimiter(fake);

    await limiter.attempt("ip-a", 0);
    await limiter.attempt("ip-b", 1_000);
    // activeKeyCount refreshes opportunistically — give the fire-and-forget
    // refresh a tick to resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(limiter.activeKeyCount).toBe(2);

    limiter.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await limiter.attempt("ip-a", 2_000)).allowed).toBe(true);
  });
});
