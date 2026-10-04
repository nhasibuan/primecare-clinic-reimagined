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

  local subj body
  subj=$(primecare_json_escape "$1")
  body=$(primecare_json_escape "$2")

  # Best-effort: alert delivery must never break the calling job.
  curl -fsS --max-time 10 https://api.resend.com/emails \
    -H "Authorization: Bearer $key" \
    -H "Content-Type: application/json" \
    -d "{\"from\":\"onboarding@resend.dev\",\"to\":[\"$to\"],\"subject\":\"$subj\",\"text\":\"$body\"}" \
    >/dev/null 2>&1 || true
  return 0
}
