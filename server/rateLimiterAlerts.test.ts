/**
 * Tests for rate-limiter degradation alerting (server/rateLimiterAlerts.ts).
 *
 * Verifies (without a live Redis or network):
 *   - episode edge-triggering: one DEGRADED email per episode, reminders
 *     only after DEGRADE_REPEAT_MS while failures continue;
 *   - the process-wide cooldown collapses a multi-limiter boot failure into
 *     one email and never fires a duplicate when the window re-opens;
 *   - a throwing sender cannot propagate (observer contract);
 *   - end-to-end with a dead Redis: many failure events → exactly one email;
 *   - the default sender is inert outside production and honors the
 *     RATE_LIMITER_ALERTS_DISABLED kill switch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

const envState = vi.hoisted(() => ({
  isProduction: false,
  rateLimiterAlertsDisabled: false,
}));
vi.mock("./_core/env", () => ({ ENV: envState }));

import {
  DEGRADE_REPEAT_MS,
  GLOBAL_COOLDOWN_MS,
  _resetLimiterAlerts,
  defaultSend,
  notifyLimiterDegraded,
} from "./rateLimiterAlerts";
import {
  _resetLimiterMetrics,
  getLimiterStats,
  recordLimiterDegradation,
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

const T0 = 1_800_000_000_000;
const config = { maxRequests: 3, windowMs: 60_000 };

beforeEach(() => {
  _resetLimiterAlerts();
  _resetLimiterMetrics();
  execFileMock.mockClear();
  envState.isProduction = false;
  envState.rateLimiterAlertsDisabled = false;
  delete process.env.RATE_LIMITER_ALERTS_DISABLED;
});

afterEach(() => {
  delete process.env.RATE_LIMITER_ALERTS_DISABLED;
});

describe("notifyLimiterDegraded episode rules", () => {
  it("sends one DEGRADED email on the first failure and stays quiet on repeats", () => {
    const send = vi.fn();
    notifyLimiterDegraded("appointments:create", { now: T0, send });
    notifyLimiterDegraded("appointments:create", { now: T0 + 1, send });
    notifyLimiterDegraded("appointments:create", { now: T0 + 2, send });
    expect(send).toHaveBeenCalledTimes(1);
    const [subject, body] = send.mock.calls[0];
    expect(subject).toContain("DEGRADED");
    expect(subject).toContain("appointments:create");
    expect(body).toContain("appointments:create");
    expect(body).toContain("fail-open");
  });

  it("sends a STILL DEGRADED reminder once DEGRADE_REPEAT_MS has passed", () => {
    const send = vi.fn();
    notifyLimiterDegraded("q", { now: T0, send });
    notifyLimiterDegraded("q", { now: T0 + DEGRADE_REPEAT_MS - 1, send });
    expect(send).toHaveBeenCalledTimes(1);
    notifyLimiterDegraded("q", { now: T0 + DEGRADE_REPEAT_MS, send });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toContain("STILL DEGRADED");
    expect(send.mock.calls[1][1]).toContain("30-minute reminder");
  });

  it("collapses a multi-limiter boot failure into a single email", () => {
    const send = vi.fn();
    notifyLimiterDegraded("login", { now: T0, send });
    notifyLimiterDegraded("appointments:create", { now: T0 + 1, send });
    notifyLimiterDegraded("uploads", { now: T0 + 2, send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toContain("login");
  });

  it("never fires a duplicate for a cooldown-suppressed limiter when the window re-opens", () => {
    const send = vi.fn();
    notifyLimiterDegraded("login", { now: T0, send });
    notifyLimiterDegraded("uploads", { now: T0 + 1, send });
    // Window re-opened and failures continue, but the episode is already
    // marked: only the 30-minute reminder may fire, not an immediate email.
    notifyLimiterDegraded("uploads", { now: T0 + GLOBAL_COOLDOWN_MS + 1000, send });
    expect(send).toHaveBeenCalledTimes(1);
    notifyLimiterDegraded("uploads", {
      now: T0 + DEGRADE_REPEAT_MS + 2000,
      send,
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toContain("STILL DEGRADED");
    expect(send.mock.calls[1][0]).toContain("uploads");
  });

  it("lets a new limiter alert once the cooldown window has passed", () => {
    const send = vi.fn();
    notifyLimiterDegraded("login", { now: T0, send });
    notifyLimiterDegraded("uploads", { now: T0 + GLOBAL_COOLDOWN_MS, send });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toContain("DEGRADED: uploads");
  });

  it("survives a throwing sender and still marks the episode", () => {
    const send = vi.fn(() => {
      throw new Error("sender blew up");
    });
    expect(() => notifyLimiterDegraded("q", { now: T0, send })).not.toThrow();
    notifyLimiterDegraded("q", { now: T0 + 1, send });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("resets episode state via the test hook", () => {
    const send = vi.fn();
    notifyLimiterDegraded("q", { now: T0, send });
    _resetLimiterAlerts();
    notifyLimiterDegraded("q", { now: T0 + 1, send });
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe("integration with RedisRateLimiter failures", () => {
  it("produces exactly one email from many failure events, registry still counts all", async () => {
    const send = vi.fn();
    let clock = T0;
    const limiter = new RedisRateLimiter(deadRedis(), config, {
      namespace: "e2e",
      failOpen: true,
      onDegraded: () => {
        recordLimiterDegradation("e2e");
        notifyLimiterDegraded("e2e", { now: clock++, send });
      },
    });

    for (let i = 0; i < 5; i++) {
      const result = await limiter.attempt("k");
      expect(result.allowed).toBe(true);
    }

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toContain("e2e");
    const [stats] = getLimiterStats();
    expect(stats.degradationCount).toBe(5);
    expect(stats.degraded).toBe(true);
  });
});

describe("defaultSend gating", () => {
  it("is inert outside production", () => {
    defaultSend("s", "b");
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("shells out to the shared notify lib in production", () => {
    envState.isProduction = true;
    defaultSend("subject", "body");
    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = execFileMock.mock.calls[0];
    expect(cmd).toBe("bash");
    expect(args[0]).toBe("/usr/local/lib/primecare-notify.sh");
    expect(args[1]).toBe("subject");
    expect(args[2]).toBe("body");
    expect(opts).toMatchObject({ timeout: 15_000 });
  });

  it("honors RATE_LIMITER_ALERTS_DISABLED in production", () => {
    envState.isProduction = true;
    envState.rateLimiterAlertsDisabled = true;
    defaultSend("s", "b");
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
