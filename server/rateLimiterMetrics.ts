/**
 * Rate limiter observability registry (Registry pattern).
 *
 * Tracks, per named limiter, which backend is active and how often it has
 * degraded. The composition root (`rateLimiterFactory.ts`) maintains this
 * registry; operators read it via the `system.rateLimiterStatus` admin
 * procedure. Counters are process-local and reset on restart — they are
 * operational telemetry, not billing data.
 */

export type LimiterBackend = "memory" | "redis";

export interface LimiterStats {
  /** Limiter name as passed to `createRateLimiter` (e.g. "appointments:create"). */
  name: string;
  /** Currently active backend. Starts as "memory"; flips to "redis" on upgrade. */
  backend: LimiterBackend;
  /**
   * True when Redis was selected but is currently unusable (init failed or a
   * runtime command failed and the limiter fell back to fail-open/closed).
   */
  degraded: boolean;
  /** Total degradation events observed by this process. */
  degradationCount: number;
  /** ISO timestamp of the most recent degradation, or null if never degraded. */
  lastDegradationAt: string | null;
}

const registry = new Map<string, LimiterStats>();

/** Ensure a limiter has a registry entry (idempotent). */
export function registerLimiter(name: string): void {
  if (!registry.has(name)) {
    registry.set(name, {
      name,
      backend: "memory",
      degraded: false,
      degradationCount: 0,
      lastDegradationAt: null,
    });
  }
}

/** Record which backend a limiter is currently running on. */
export function setLimiterBackend(name: string, backend: LimiterBackend): void {
  registerLimiter(name);
  const stats = registry.get(name)!;
  stats.backend = backend;
  if (backend === "redis") {
    // A successful (re)connection clears the degraded flag; the historical
    // count is preserved so operators can see past instability.
    stats.degraded = false;
  }
}

/** Record one degradation event (Redis init failure or fail-open/fail-closed). */
export function recordLimiterDegradation(name: string): void {
  registerLimiter(name);
  const stats = registry.get(name)!;
  stats.degraded = true;
  stats.degradationCount += 1;
  stats.lastDegradationAt = new Date().toISOString();
}

/** Snapshot of every known limiter's stats (safe to expose to admins). */
export function getLimiterStats(): LimiterStats[] {
  return [...registry.values()];
}

/** Test-only hook: clears the registry between test cases. */
export function _resetLimiterMetrics(): void {
  registry.clear();
}
