#!/usr/bin/env bash
# Shared alert-delivery helper for PrimeCare operational scripts.
#
# Sourced by deploy/primecare-watchdog.sh (downtime alerts) and
# scripts/uptime-weekly.sh (weekly uptime review). Sends via the Resend
# API when credentials are configured; otherwise a silent no-op so every
# caller can invoke it unconditionally.
#
# Configuration: /usr/local/lib/primecare-alert.env (root-only, chmod 600):
#   RESEND_API_KEY=re_...
#   ALERT_EMAIL_TO=you@example.com
# Resend's free tier delivers only to the account owner's address until a
# domain is verified; use the account's address. Add both values to the
# secrets vault (SECRETS_RECOVERY.md) when set.
#
# Every send attempt (SENT or FAIL) is appended to /root/primecare-notify.log
# (chmod 600) — a dead/rotated-out API key or a network failure shows up in
# the log instead of silently silencing alerts. Weekly SENT lines double as
# a delivery heartbeat for the Saturday review.
#
# Escapes JSON properly; multiline bodies are fine.

primecare_json_escape() {
  printf '%s' "$1" \
    | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' \
    | awk '{printf "%s\\n", $0}' | sed -e 's/\\n$//'
}

primecare_notify() { # primecare_notify <subject> <body>
  local env_file="/usr/local/lib/primecare-alert.env"
  [ -r "$env_file" ] || return 0

  local key to
  key=$(grep '^RESEND_API_KEY=' "$env_file" | head -n1 | cut -d= -f2- | tr -d '"')
  to=$(grep '^ALERT_EMAIL_TO=' "$env_file" | head -n1 | cut -d= -f2- | tr -d '"')
  [ -n "$key" ] && [ -n "$to" ] || return 0

  local subj body payload log_file
  subj=$(primecare_json_escape "$1")
  body=$(primecare_json_escape "$2")
  payload="{\"from\":\"onboarding@resend.dev\",\"to\":[\"$to\"],\"subject\":\"$subj\",\"text\":\"$body\"}"

  log_file="/root/primecare-notify.log"
  [ -f "$log_file" ] || (umask 077 && : > "$log_file")

  local tmp http_code rc
  tmp=$(mktemp)
  # Best-effort: alert delivery must never break the calling job — the
  # function always returns 0 and records the outcome in the log instead.
  http_code=$(curl -sS -o "$tmp" -w '%{http_code}' --max-time 10 \
    -H "Authorization: Bearer $key" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    https://api.resend.com/emails 2>"$tmp.err")
  rc=$?
  if [ "$rc" -eq 0 ] && [ "$http_code" -ge 200 ] 2>/dev/null && [ "$http_code" -lt 300 ] 2>/dev/null; then
    printf '%s SENT http=%s to=%s subj=%s\n' \
      "$(date -u +%FT%TZ)" "$http_code" "$to" "$1" >> "$log_file"
  else
    printf '%s FAIL rc=%s http=%s to=%s subj=%s err=%s\n' \
      "$(date -u +%FT%TZ)" "$rc" "$http_code" "$to" "$1" \
      "$( { tr '\n\t' '  ' < "$tmp" 2>/dev/null; tr '\n\t' '  ' < "$tmp.err" 2>/dev/null; } | sed 's/^ *//' | head -c 200 )" \
      >> "$log_file"
  fi
  rm -f "$tmp" "$tmp.err"
  return 0
}
