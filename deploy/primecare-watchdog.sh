#!/usr/bin/env bash
# PrimeCare uptime watchdog.
#
# Complements systemd's Restart=on-failure (which only fires on crashes, not
# hangs): health-checks the app and the tunnel every 2 minutes and restarts
# the offending unit when something stops answering.
#
#   local /healthz fails          → restart primecare (double-checked first)
#   public URL fails, local ok    → restart cloudflared (tunnel remediation)
#
# Outputs:
#   - /root/uptime-checks.log    one line per check (rotated at 1 MB) — the
#                                raw data for scripts/uptime-report.sh
#   - /root/uptime-status.txt    rewritten every run (current state)
#   - /root/uptime-history.log   transitions and hourly degraded reminders
#
# Alerts fire on transitions only (no spam); hook point in notify().
#
# Env overrides for testing: LOCAL_URL, PUBLIC_URL, DRY_RUN=1 (logs actions,
# writes no per-check line, executes no systemctl restarts).
set -uo pipefail

LOCAL_URL="${LOCAL_URL:-http://localhost:3000/healthz}"
PUBLIC_URL="${PUBLIC_URL:-https://www.berkatinsani.id/healthz}"
STATUS="/root/uptime-status.txt"
HISTORY="/root/uptime-history.log"
CHECKS="/root/uptime-checks.log"
CHECKS_MAX_BYTES=1048576
CHECKS_KEEP_LINES=20000
STATE_FILE="/root/.uptime-watchdog-state"
LASTCHANGE_FILE="/root/.uptime-watchdog-lastchange"
REMINDER_SECS=3600
DRY_RUN="${DRY_RUN:-0}"

# Optional email alerts: silent no-op unless /usr/local/lib/primecare-alert.env
# holds RESEND_API_KEY + ALERT_EMAIL_TO (see deploy/primecare-notify.sh).
. /usr/local/lib/primecare-notify.sh 2>/dev/null || true

now=$(date -u +%FT%TZ)
nowepoch=$(date +%s)

# probe <url> <max-seconds> → sets RESP_OK (0/1) and RESP_MS (integer).
probe() {
  local t
  if t=$(curl -fsS --max-time "$2" -o /dev/null -sS -w '%{time_total}' "$1" 2>/dev/null); then
    RESP_OK=1
    RESP_MS=$(awk -v x="$t" 'BEGIN{printf "%d", x*1000}')
  else
    RESP_OK=0
    RESP_MS=0
  fi
}

act() { # act <description> <command...>
  if [ "$DRY_RUN" = "1" ]; then
    echo "$now DRY-RUN would: $1"
    return 0
  fi
  "$@" >/dev/null 2>&1
}

# notify <kind> <message>: fires on transitions and hourly reminders.
# Extension point for future channels (Resend/Telegram); today it lands in
# the history log + systemd journal (stdout of the service unit).
notify() {
  echo "$now $1 $2" >> "$HISTORY"
  echo "watchdog: $1 $2"
  primecare_notify "PrimeCare uptime: $1" "$2"
}

rotate_check_log() {
  local size
  size=$(stat -c %s "$CHECKS" 2>/dev/null || echo 0)
  if [ "$size" -gt "$CHECKS_MAX_BYTES" ]; then
    tail -n "$CHECKS_KEEP_LINES" "$CHECKS" > "$CHECKS.tmp" && mv "$CHECKS.tmp" "$CHECKS"
  fi
}

# --- health checks ----------------------------------------------------------
probe "$LOCAL_URL" 5
local_ok=$RESP_OK
local_ms=$RESP_MS
probe "$PUBLIC_URL" 15
public_ok=$RESP_OK
public_ms=$RESP_MS

state=DOWN
if [ "$local_ok" -eq 1 ] && [ "$public_ok" -eq 1 ]; then
  state=UP
elif [ "$local_ok" -eq 1 ]; then
  state=DEGRADED # app fine, tunnel/cloudflare path broken
fi

prev=$(cat "$STATE_FILE" 2>/dev/null || echo UP)
actions="none"

# --- remediation -------------------------------------------------------------
if [ "$local_ok" -eq 0 ]; then
  # Grace re-check: don't kick the app mid-restart/deploy window.
  sleep 5
  probe "$LOCAL_URL" 5
  local_ok=$RESP_OK
  local_ms=$RESP_MS
  if [ "$local_ok" -eq 0 ]; then
    actions="restarted primecare"
    act "systemctl restart primecare" systemctl restart primecare
    sleep 8
    probe "$LOCAL_URL" 5
    local_ok=$RESP_OK
    local_ms=$RESP_MS
  fi
  if [ "$local_ok" -eq 1 ]; then
    probe "$PUBLIC_URL" 15
    public_ok=$RESP_OK
    public_ms=$RESP_MS
    state=UP; [ "$public_ok" -eq 0 ] && state=DEGRADED
  else
    state=DOWN
  fi
elif [ "$public_ok" -eq 0 ]; then
  # Grace re-check for transient Cloudflare edge blips.
  sleep 5
  probe "$PUBLIC_URL" 15
  public_ok=$RESP_OK
  public_ms=$RESP_MS
  if [ "$public_ok" -eq 0 ]; then
    actions="restarted cloudflared"
    act "systemctl restart cloudflared" systemctl restart cloudflared
    sleep 8
    probe "$PUBLIC_URL" 15
    public_ok=$RESP_OK
    public_ms=$RESP_MS
  fi
  state=UP; [ "$public_ok" -eq 0 ] && state=DEGRADED
fi

# --- per-check log (the dashboard's raw data) ---------------------------------
if [ "$DRY_RUN" != "1" ]; then
  rotate_check_log
  echo "$now $state l=$local_ok/${local_ms}ms p=$public_ok/${public_ms}ms act=$actions" >> "$CHECKS"
fi

# --- transitions + reminders ---------------------------------------------------
if [ "$state" != "$prev" ]; then
  date +%s > "$LASTCHANGE_FILE"
  notify "TRANSITION" "$prev -> $state (action: $actions)"
elif [ "$state" != "UP" ]; then
  lastchange=$(cat "$LASTCHANGE_FILE" 2>/dev/null || echo "$nowepoch")
  if [ $((nowepoch - lastchange)) -ge "$REMINDER_SECS" ]; then
    date +%s > "$LASTCHANGE_FILE"
    notify "REMINDER" "still $state after $((REMINDER_SECS / 60))min (action: $actions)"
  fi
fi
echo "$state" > "$STATE_FILE"

# --- status report -------------------------------------------------------------
{
  echo "PrimeCare uptime watchdog — $now"
  echo "state:            $state"
  echo "local  $LOCAL_URL: $([ "$local_ok" -eq 1 ] && echo "ok ${local_ms}ms" || echo FAIL)"
  echo "public $PUBLIC_URL: $([ "$public_ok" -eq 1 ] && echo "ok ${public_ms}ms" || echo FAIL)"
  echo "last action:      $actions"
  echo "previous state:   $prev"
  echo "history:          tail -n 20 $HISTORY"
  echo "per-check log:    $CHECKS (dashboard: uptime-report)"
} > "$STATUS"

[ "$state" = "UP" ] || exit 1
exit 0
