#!/usr/bin/env bash
# PrimeCare uptime report from the watchdog's per-check log.
#
# Usage: scripts/uptime-report.sh [window-hours] [text|json]
#   uptime-report.sh          → last 24h, human-readable
#   uptime-report.sh 168      → last 7 days
#   uptime-report.sh 24 json  → machine-readable (status pages, cron mail)
#
# Data source: /root/uptime-checks.log — one line per 2-minute watchdog run:
#   2026-10-02T04:10:22Z DOWN l=0/0ms p=1/450ms act=restarted primecare
#
# Metric semantics: state is DOWN when the local app is unhealthy (outage),
# DEGRADED when only the public path fails (tunnel/Cloudflare). Uptime % =
# share of UP checks in the window; a check every 2 minutes → resolution of
# ±2 minutes on any incident boundary.
set -u

CHECKS="/root/uptime-checks.log"
HOURS="${1:-24}"
FORMAT="${2:-text}"

[ -r "$CHECKS" ] || { echo "no checks log at $CHECKS yet" >&2; exit 1; }
[ -s "$CHECKS" ] || { echo "checks log is empty — watchdog has not logged a real check yet" >&2; exit 1; }

CUTOVER_EPOCH=$(( $(date +%s) - HOURS * 3600 ))

# Parse lines newer than the window. Timestamps are UTC (…Z); date -d handles
# them and -u keeps comparisons timezone-free.
rows=$(awk -v cut="$CUTOVER_EPOCH" '
  {
    ts = substr($1, 1, 19)
    cmd = "date -u -d \"" ts "Z\" +%s"
    cmd | getline epoch
    close(cmd)
    if (epoch >= cut) print
  }' "$CHECKS")

total=$(printf '%s\n' "$rows" | grep -c .)
[ "$total" -gt 0 ] || { echo "no checks in the last ${HOURS}h (log may predate the window)" >&2; exit 1; }
up=$(printf '%s\n' "$rows" | awk '$2=="UP"' | grep -c .)
down=$(printf '%s\n' "$rows" | awk '$2=="DOWN"' | grep -c .)
degraded=$(printf '%s\n' "$rows" | awk '$2=="DEGRADED"' | grep -c .)

# Latency: public path when up, else local, else 0 (failed probes).
lat_summary=$(printf '%s\n' "$rows" | awk '
  $2=="UP"        { split($4, a, "/"); s+=substr(a[2],1,length(a[2])-2); n++ }
  $2=="DEGRADED"  { split($3, b, "/"); s+=substr(b[2],1,length(b[2])-2); n++ }
  END { if (n>0) printf "%.1f %d", s/n, n; else print "0 0" }')
avg_ms=${lat_summary%% *}

pct=$(awk -v up="$up" -v total="$total" 'BEGIN{printf "%.2f", up*100/total}')

incidents=$(printf '%s\n' "$rows" | awk '
  $2!="UP" && prev=="UP"     { print "INCIDENT", $1, $2 }
  { prev=$2 }')
incident_count=$(printf '%s\n' "$incidents" | grep -c . || true)
restarts=$(printf '%s\n' "$rows" | grep -c 'act=restarted' || true)

if [ "$FORMAT" = "json" ]; then
  printf '{"window_hours":%s,"checks":%s,"up":%s,"degraded":%s,"down":%s,"uptime_pct":%s,"avg_response_ms":%s,"incidents":%s,"watchdog_restarts":%s,"generated_at":"%s"}\n' \
    "$HOURS" "$total" "$up" "$degraded" "$down" "$pct" "$avg_ms" "$incident_count" "$restarts" \
    "$(date -u +%FT%TZ)"
  exit 0
fi

echo "PrimeCare uptime — last ${HOURS}h (as of $(date -u +%FT%TZ))"
echo "  checks:            $total (~$(( total * 2 / 60 ))h covered at 2-min cadence)"
echo "  uptime:            ${pct}%  (UP: $up, DEGRADED: $degraded, DOWN: $down)"
echo "  avg response:      ${avg_ms} ms"
echo "  incident starts:   $incident_count"
echo "  watchdog restarts: $restarts"
if [ "$incident_count" -gt 0 ]; then
  echo "  incidents:"
  printf '%s\n' "$incidents" | sed 's/^/    /'
fi
