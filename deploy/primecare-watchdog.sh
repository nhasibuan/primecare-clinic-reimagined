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
# State machine:
#   - /root/uptime-status.txt   rewritten every run (current state, last action)
#   - /root/uptime-history.log  appended on state transitions and hourly
#                               reminders while degraded
#   - alerts fire on transitions only (no email spam); hook point in notify()
#
# Env overrides for testing: LOCAL_URL, PUBLIC_URL, DRY_RUN=1 (logs actions
# without executing systemctl restarts).
set -uo pipefail

LOCAL_URL="${LOCAL_URL:-http://localhost:3000/healthz}"
PUBLIC_URL="${PUBLIC_URL:-https://www.berkatinsani.id/healthz}"
STATUS="/root/uptime-status.txt"
HISTORY="/root/uptime-history.log"
STATE_FILE="/root/.uptime-watchdog-state"
LASTCHANGE_FILE="/root/.uptime-watchdog-lastchange"
REMINDER_SECS=3600
DRY_RUN="${DRY_RUN:-0}"

now=$(date -u +%FT%TZ)
nowepoch=$(date +%s)

curl_ok() { curl -fsS --max-time "$1" "$2" >/dev/null 2>&1; }

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
}

# --- health checks ----------------------------------------------------------
local_ok=0
curl_ok 5 "$LOCAL_URL" && local_ok=1
public_ok=0
curl_ok 15 "$PUBLIC_URL" && public_ok=1

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
  if curl_ok 5 "$LOCAL_URL"; then
    local_ok=1
  else
    actions="restarted primecare"
    act "systemctl restart primecare" systemctl restart primecare
    sleep 8
    curl_ok 5 "$LOCAL_URL" && local_ok=1
  fi
  if [ "$local_ok" -eq 1 ]; then
    curl_ok 15 "$PUBLIC_URL" && public_ok=1
    state=UP; [ "$public_ok" -eq 0 ] && state=DEGRADED
  else
    state=DOWN
  fi
elif [ "$public_ok" -eq 0 ]; then
  # Grace re-check for transient Cloudflare edge blips.
  sleep 5
  if ! curl_ok 15 "$PUBLIC_URL"; then
    actions="restarted cloudflared"
    act "systemctl restart cloudflared" systemctl restart cloudflared
    sleep 8
    curl_ok 15 "$PUBLIC_URL" && public_ok=1
  else
    public_ok=1
  fi
  state=UP; [ "$public_ok" -eq 0 ] && state=DEGRADED
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
  echo "local  $LOCAL_URL: $([ "$local_ok" -eq 1 ] && echo ok || echo FAIL)"
  echo "public $PUBLIC_URL: $([ "$public_ok" -eq 1 ] && echo ok || echo FAIL)"
  echo "last action:      $actions"
  echo "previous state:   $prev"
  echo "history:          tail -n 20 $HISTORY"
} > "$STATUS"

[ "$state" = "UP" ] || exit 1
exit 0
