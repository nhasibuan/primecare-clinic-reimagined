#!/usr/bin/env bash
# Weekly uptime review for PrimeCare.
#
# Runs the 7-day uptime report and emails it (via deploy/primecare-notify.sh;
# no-op without alert credentials). The review lands in the inbox every week
# even when all-clear — silence would be ambiguous, and a missing email is
# itself a signal that the timer or the box is in trouble. Scheduled by
# primecare-uptime-weekly.timer, Saturday 03:17 UTC (after the Friday-evening
# clinic rush, well before the Saturday-morning backup at 02:30 local).
#
# Baseline thresholds (set 2026-10-03 from first week of per-check data,
# ~15 checks/30min at 100% UP, avg public latency 149ms, range ~100-180ms):
#   UPTIME_FLOOR_PCT   flag weeks below 99% (max ~87 degraded minutes/week)
#   LATENCY_WARN_MS    flag sustained public latency over 400ms (~3x baseline)
# Incidents and watchdog restarts are always reported when nonzero.
set -u

REPORT_SCRIPT="/usr/local/lib/uptime-report.sh"
[ -x "$REPORT_SCRIPT" ] || REPORT_SCRIPT="/usr/local/bin/uptime-report"
[ -x "$REPORT_SCRIPT" ] || REPORT_SCRIPT="$(dirname "$0")/uptime-report.sh"

UPTIME_FLOOR_PCT=99
LATENCY_WARN_MS=400

TEXT=$("$REPORT_SCRIPT" 168) || { echo "uptime report failed" >&2; exit 1; }
JSON=$("$REPORT_SCRIPT" 168 json)

uptime_pct=$(printf '%s' "$JSON" | sed -n 's/.*"uptime_pct":\([0-9.]*\).*/\1/p')
avg_ms=$(printf '%s' "$JSON" | sed -n 's/.*"avg_response_ms":\([0-9.]*\).*/\1/p')
incidents=$(printf '%s' "$JSON" | sed -n 's/.*"incidents":\([0-9]*\).*/\1/p')
restarts=$(printf '%s' "$JSON" | sed -n 's/.*"watchdog_restarts":\([0-9]*\).*/\1/p')

flags=""
awk -v u="$uptime_pct" -v f="$UPTIME_FLOOR_PCT" 'BEGIN{exit !(u<f)}' \
  && flags="${flags}uptime ${uptime_pct}% < ${UPTIME_FLOOR_PCT}%; "
awk -v l="$avg_ms" -v w="$LATENCY_WARN_MS" 'BEGIN{exit !(l>w)}' \
  && flags="${flags}avg latency ${avg_ms}ms > ${LATENCY_WARN_MS}ms; "
[ "$incidents" -gt 0 ] 2>/dev/null && flags="${flags}${incidents} incident(s); "
[ "$restarts" -gt 0 ] 2>/dev/null && flags="${flags}${restarts} watchdog restart(s); "

if [ -n "$flags" ]; then
  verdict="ATTENTION: $flags"
else
  verdict="All clear."
fi

body="PrimeCare weekly uptime review — $(date -u +%FT%TZ)

$verdict

$TEXT
"
echo "$body"

# Email (no-op without /usr/local/lib/primecare-alert.env). Subject mirrors
# the verdict so the inbox itself is scannable.
. /usr/local/lib/primecare-notify.sh 2>/dev/null || true
primecare_notify "PrimeCare weekly uptime: $verdict" "$body"
