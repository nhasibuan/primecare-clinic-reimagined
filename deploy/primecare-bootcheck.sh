#!/usr/bin/env bash
# PrimeCare post-boot self-check.
# Runs once at boot (primecare-bootcheck.service): waits for the stack to come
# up, verifies local health and the public tunnel URL, writes a timestamped
# report to /root/bootcheck-report.txt, and fails (non-zero) if the local
# stack is not healthy — visible via `systemctl status primecare-bootcheck`.
set -u
REPORT=/root/bootcheck-report.txt
URL=https://www.berkatinsani.id/healthz
DEADLINE=$(( $(date +%s) + 90 ))

: > "$REPORT"
echo "PrimeCare boot check — $(date -u +%FT%TZ)" >> "$REPORT"

check_unit() {
  if systemctl is-active --quiet "$1"; then
    echo "ok      unit $1 active" >> "$REPORT"
  else
    echo "FAIL    unit $1 not active" >> "$REPORT"
    return 1
  fi
}

# Timers must be active (waiting) AND enabled, or they will not survive reboot.
check_timer() {
  if systemctl is-active --quiet "$1" && systemctl is-enabled --quiet "$1" 2>/dev/null; then
    echo "ok      timer $1 active + enabled" >> "$REPORT"
  else
    echo "FAIL    timer $1 not active/enabled — systemctl status $1" >> "$REPORT"
    return 1
  fi
}

wait_local_health() {
  while [ "$(date +%s)" -lt "$DEADLINE" ]; do
    if curl -fsS http://localhost:3000/healthz >/dev/null 2>&1; then return 0; fi
    sleep 3
  done
  return 1
}

fail=0
check_unit mysql       || fail=1
check_unit primecare   || fail=1
check_unit cloudflared || fail=1

check_timer primecare-backup.timer        || fail=1
check_timer primecare-restore-drill.timer || fail=1
check_timer primecare-watchdog.timer      || fail=1
check_timer primecare-uptime-weekly.timer || fail=1

if wait_local_health; then
  echo "ok      local /healthz responded" >> "$REPORT"
else
  echo "FAIL    local /healthz did not respond within 90s" >> "$REPORT"
  fail=1
fi

# Public URL: best-effort (tunnel may take longer than the check window).
if curl -fsS --max-time 10 "$URL" >> "$REPORT" 2>&1; then
  echo "" >> "$REPORT"
  echo "ok      public $URL responded" >> "$REPORT"
else
  echo "warn    public $URL not reachable yet (check cloudflared logs)" >> "$REPORT"
fi

if [ "$fail" -eq 0 ]; then
  echo "RESULT: healthy" >> "$REPORT"
else
  echo "RESULT: UNHEALTHY — inspect: systemctl status mysql primecare cloudflared; journalctl -u primecare -n 50" >> "$REPORT"
fi
exit "$fail"
