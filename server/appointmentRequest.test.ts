import { describe, expect, it } from "vitest";
import {
  getClientIp,
  isAutomatedAppointmentRequest,
  normalizeAppointmentNote,
} from "./appointmentRequest";
import { InMemoryRateLimiter } from "./rateLimiter";

function makeLimiter(maxKeys?: number) {
  return new InMemoryRateLimiter({ maxRequests: 3, windowMs: 60_000, maxKeys });
}

describe("appointment request privacy helpers", () => {
  it("normalizes optional scheduling notes without retaining blank data", async () => {
    expect(normalizeAppointmentNote("  Mohon   konfirmasi  jadwal. ")).toBe(
      "Mohon konfirmasi jadwal."
    );
    expect(normalizeAppointmentNote("   ")).toBeNull();
  });

  it("detects a completed spam honeypot", () => {
    expect(isAutomatedAppointmentRequest("")).toBe(false);
    expect(isAutomatedAppointmentRequest("https://spam.example")).toBe(true);
  });

  it("allows normal submissions while rejecting rapid repeats from the same IP", async () => {
    const limiter = makeLimiter();
    const clientIp = "203.0.113.42";

    expect((await limiter.attempt(clientIp, 0)).allowed).toBe(true);
    expect((await limiter.attempt(clientIp, 1_000)).allowed).toBe(true);
    expect((await limiter.attempt(clientIp, 2_000)).allowed).toBe(true);

    const blocked = await limiter.attempt(clientIp, 3_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(57_000);

    expect((await limiter.attempt("198.51.100.7", 3_000)).allowed).toBe(true);
    expect((await limiter.attempt(clientIp, 60_000)).allowed).toBe(true);
  });

  it("uses Express's resolved client IP and falls back safely when unavailable", () => {
    expect(
      getClientIp({
        ip: "203.0.113.42",
        socket: { remoteAddress: "127.0.0.1" },
      })
    ).toBe("203.0.113.42");
    expect(getClientIp({ socket: { remoteAddress: "198.51.100.7" } })).toBe(
      "198.51.100.7"
    );
    expect(getClientIp({})).toBe("unknown");
  });

  it("prunes expired clients and caps the number of tracked IPs", async () => {
    const limiter = makeLimiter(2);

    await limiter.attempt("203.0.113.1", 0);
    await limiter.attempt("203.0.113.2", 1);
    await limiter.attempt("203.0.113.3", 2);
    expect(limiter.activeKeyCount).toBe(2);

    await limiter.attempt("203.0.113.4", 60_002);
    expect(limiter.activeKeyCount).toBe(1);
  });

  it("enforces a true sliding window across the fixed-window boundary", async () => {
    // A fixed-window counter would allow 6 requests here (3 at the end of
    // window one + 3 at the start of window two). The sliding window allows
    // only 3 within any 60-second span.
    const limiter = makeLimiter();
    const clientIp = "203.0.113.77";

    expect((await limiter.attempt(clientIp, 59_000)).allowed).toBe(true);
    expect((await limiter.attempt(clientIp, 59_500)).allowed).toBe(true);
    expect((await limiter.attempt(clientIp, 59_900)).allowed).toBe(true);

    const acrossBoundary = await limiter.attempt(clientIp, 60_100);
    expect(acrossBoundary.allowed).toBe(false);
    // Slot frees when the oldest in-window attempt (t=59_000) exits the window.
    expect(acrossBoundary.retryAfterMs).toBe(58_900);

    expect((await limiter.attempt(clientIp, 119_001)).allowed).toBe(true);
  });

  it("rejects malformed IP-like strings instead of trusting them", () => {
    expect(getClientIp({ ip: ":::" })).toBe("unknown");
    expect(getClientIp({ ip: "300.1.2.3" })).toBe("unknown");
    expect(getClientIp({ ip: "999.999.999.999" })).toBe("unknown");
    expect(getClientIp({ ip: "2001:db8::1" })).toBe("2001:db8::1");
    expect(getClientIp({ ip: "::ffff:203.0.113.9" })).toBe(
      "::ffff:203.0.113.9"
    );
  });
});
