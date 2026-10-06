/**
 * Edge-triggered email alerts for rate limiter degradation.
 *
 * The limiter's `onDegraded` observer fires on EVERY failed Redis command (by
 * design — the metrics registry wants the full count), so this module owns
 * the deduplication: it converts the per-event stream into episodes and
 * emails at most
 *
 *   - one "DEGRADED" email when the first failure of a limiter's episode
 *     arrives, and
 *   - a "STILL DEGRADED" reminder if failures keep arriving
 *     DEGRADE_REPEAT_MS (30 min) after the last notice for that limiter,
 *
 * subject to a process-wide GLOBAL_COOLDOWN_MS (5 min) so a boot-time Redis
 * outage across all limiters (login, appointment submission, upload)
 * collapses into a single email instead of one per limiter. A limiter whose
 * first event lands inside another limiter's cooldown window is marked as
 * alerted without sending, so it cannot fire a duplicate the moment the
 * window re-opens.
 *
 * Delivery reuses the same alert channel as the watchdog and the weekly
 * review (`/usr/local/lib/primecare-notify.sh`, CLI mode): outcomes are
 * appended to /root/primecare-notify.log and `primecare-resend-rotate` keeps
 * working with no second copy of the API key. The default sender is inert
 * outside production and can be disabled with RATE_LIMITER_ALERTS_DISABLED=true.
 *
 * Contract (mirrors the limiter's observer rules): alerting must never throw
 * and never delay rate limiting — bookkeeping is synchronous, the send is
 * fire-and-forget, and every error is swallowed into a console.warn.
 */

import { execFile } from "node:child_process";
import { ENV } from "./_core/env";
import { getLimiterStats } from "./rateLimiterMetrics";

/** Shell alert lib shared with the watchdog and the weekly review. */
const NOTIFY_LIB = "/usr/local/lib/primecare-notify.sh";

/** Re-notify interval while degradation events keep arriving for one limiter. */
export const DEGRADE_REPEAT_MS = 30 * 60_000;

/** Minimum gap between any two alert emails process-wide (boot-storm guard). */
export const GLOBAL_COOLDOWN_MS = 5 * 60_000;

export type DegradeAlertSender = (subject: string, body: string) => void;

interface DegradeEpisode {
  alerted: boolean;
  lastNotifiedAt: number;
}

const episodes = new Map<string, DegradeEpisode>();
let lastGlobalAlertAt = 0;

/**
 * Record a degradation event for `name` and email the ops address when the
 * episode rules allow (first failure, or a due reminder passing the global
 * cooldown). Safe to call on every single failure event.
 */
export function notifyLimiterDegraded(
  name: string,
  opts: { now?: number; send?: DegradeAlertSender } = {}
): void {
  const now = opts.now ?? Date.now();
  const send = opts.send ?? defaultSend;

  const episode = episodes.get(name);
  const firstEvent = !episode?.alerted;
  const reminderDue =
    episode?.alerted === true &&
    now - episode.lastNotifiedAt >= DEGRADE_REPEAT_MS;
  if (!firstEvent && !reminderDue) return;

  // Bookkeeping happens synchronously whether or not the email goes out: a
  // suppressed episode must not re-fire when the cooldown re-opens, and a
  // suppressed reminder must not retry (and re-spawn the sender) on every
  // subsequent failure during an outage.
  episodes.set(name, { alerted: true, lastNotifiedAt: now });

  if (now - lastGlobalAlertAt < GLOBAL_COOLDOWN_MS) {
    console.warn(
      JSON.stringify({
        timestamp: new Date(now).toISOString(),
        level: "warn",
        component: "rateLimiterAlerts",
        message: `Degradation alert for limiter=${name} suppressed by the ${GLOBAL_COOLDOWN_MS / 1000}s process-wide cooldown (another limiter alerted recently).`,
      })
    );
    return;
  }
  lastGlobalAlertAt = now;

  const subject = reminderDue
    ? `PrimeCare rate limiter STILL DEGRADED: ${name}`
    : `PrimeCare rate limiter DEGRADED: ${name}`;
  try {
    send(subject, buildBody(name, now, reminderDue === true));
  } catch (error) {
    // Observers must never break rate limiting; the send failure is visible
    // in the journal and, for the default sender, in the notify log.
    console.warn(
      JSON.stringify({
        timestamp: new Date(now).toISOString(),
        level: "warn",
        component: "rateLimiterAlerts",
        message: "Rate limiter degradation alert could not be dispatched.",
        error: error instanceof Error ? error.message : "Unknown",
      })
    );
    return;
  }
  console.info(
    JSON.stringify({
      timestamp: new Date(now).toISOString(),
      level: "info",
      component: "rateLimiterAlerts",
      message: `Degradation alert dispatched for limiter=${name} (reminder=${reminderDue}).`,
    })
  );
}

/** Test-only hook: clears episode state between test cases. */
export function _resetLimiterAlerts(): void {
  episodes.clear();
  lastGlobalAlertAt = 0;
}

function buildBody(name: string, at: number, reminder: boolean): string {
  const stats = getLimiterStats().find(s => s.name === name);
  const lines = [
    `Rate limiter "${name}" degraded at ${new Date(at).toISOString()}.`,
    stats
      ? `Backend: ${stats.backend}; degradation count: ${stats.degradationCount}; last event: ${stats.lastDegradationAt ?? "n/a"}.`
      : "No registry telemetry available for this limiter yet.",
    reminder
      ? "Failures are still occurring — this is the scheduled 30-minute reminder."
      : "Posture is fail-open: requests keep working without the shared quota limit.",
    "The limiter recovers automatically once Redis commands succeed again.",
    "Investigate with: journalctl -u primecare | grep rateLimiter, and the admin system.rateLimiterStatus procedure (per-limiter telemetry).",
  ];
  return lines.join("\n");
}

/**
 * Production sender: shells out to the shared notify lib (CLI mode) so the
 * Resend key, rotation tooling, and SENT/FAIL audit log stay single-sourced.
 * Inert outside production and when RATE_LIMITER_ALERTS_DISABLED=true.
 */
export function defaultSend(subject: string, body: string): void {
  if (!ENV.isProduction) return;
  if (ENV.rateLimiterAlertsDisabled) return;
  execFile(
    "bash",
    [NOTIFY_LIB, subject, body],
    { timeout: 15_000 },
    error => {
      if (error) {
        console.warn(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "warn",
            component: "rateLimiterAlerts",
            message: "Rate limiter alert delivery failed (see /root/primecare-notify.log).",
            error: error.message,
          })
        );
      }
    }
  );
}
