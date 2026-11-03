#!/usr/bin/env bash
#
# Production deploy for PrimeCare Clinic (primecare.service).
#
# Pulls the exact state of origin/<branch>, installs dependencies, rebuilds,
# syncs the systemd unit if it changed, restarts the service, and verifies the
# app is serving. On a failed health check it rolls back to the previously
# running commit (and the previous unit).
#
# Invoked over SSH by .github/workflows/deploy.yml. Must run as a user that can
# restart primecare.service (root, or a user with passwordless sudo).

set -euo pipefail

# --- Config -------------------------------------------------------------------
APP_DIR="/g/primecare-clinic-reimagined"
SERVICE="primecare.service"
BRANCH="main"
HEALTH_URL="http://127.0.0.1:3000/healthz"
HEALTH_TIMEOUT=30 # seconds to wait for the app to come up after restart
# systemd unit: the repo file is the source of truth; it is installed only when
# it differs from what is currently on disk.
UNIT_SRC="$APP_DIR/deploy/primecare.service"
UNIT_DST="/etc/systemd/system/primecare.service"
UNIT_BACKUP="/run/primecare.service.prev.$$"

# Non-interactive SSH has a minimal PATH; make sure the toolchain is found.
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

log() { echo "[deploy] $*"; }

# Append-only audit trail for every deploy attempt (VM-side, mirrors the app's
# audit-log discipline). Best-effort: a logging failure must never abort a
# deploy. trigger=ci when invoked over SSH by the workflow, else manual.
LOG_FILE="/var/log/primecare-deploy.log"
audit() {
  local result="$1" prev="${2:-}" new="${3:-}" health="${4:-}"
  local trigger="manual"
  [ -n "${SSH_ORIGINAL_COMMAND:-}" ] && trigger="ci"
  printf '%s result=%s prev=%s new=%s health=%s trigger=%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$result" "$prev" "$new" "$health" "$trigger" \
    >>"$LOG_FILE" 2>/dev/null || true
}
touch "$LOG_FILE" 2>/dev/null && chmod 600 "$LOG_FILE" 2>/dev/null || true

cd "$APP_DIR"

# --- Safety: never deploy over uncommitted local changes ----------------------
if [ -n "$(git status --porcelain)" ]; then
  log "ERROR: working tree is not clean; refusing to deploy."
  git status --short
  audit "ABORTED_DIRTY"
  exit 1
fi

PREV_COMMIT="$(git rev-parse HEAD)"
log "Currently running: ${PREV_COMMIT:0:7}"

# --- Pull the exact state of origin/<branch> ----------------------------------
log "Fetching origin/${BRANCH}..."
git fetch origin "$BRANCH"

# --- Safety: never discard commits that are not on origin/<branch> ------------
# The dirty-tree guard above only catches uncommitted changes. A local commit
# that was never pushed would be silently discarded by the reset below, so
# refuse to run unless HEAD is already contained in origin/<branch>.
if ! git merge-base --is-ancestor HEAD "origin/$BRANCH"; then
  log "ERROR: HEAD is not on origin/${BRANCH}; refusing to deploy."
  log "  HEAD:            $(git rev-parse --short HEAD)"
  log "  origin/${BRANCH}: $(git rev-parse --short "origin/$BRANCH")"
  log "  Push the commit(s) first (or reset intentionally), then retry."
  audit "ABORTED_UNPUSHED"
  exit 1
fi

# reset --hard (not pull): the VM is production and must mirror origin/main
# exactly, with no merge or divergence. The two guards above guarantee nothing
# local (uncommitted or unpushed) is lost.
git reset --hard "origin/$BRANCH"
NEW_COMMIT="$(git rev-parse HEAD)"
log "Deploying: ${NEW_COMMIT:0:7}"

# --- Install + build ----------------------------------------------------------
log "Installing dependencies (frozen lockfile)..."
pnpm install --frozen-lockfile

log "Building..."
pnpm build

# --- Sync the systemd unit (only when the repo unit changed) ------------------
# This script only restarts the service; a change to deploy/primecare.service
# would otherwise sit unapplied until someone copied it by hand. Compare the
# repo unit with the installed one and reload systemd only when they differ.
unit_changed=false
if [ -f "$UNIT_SRC" ]; then
  if ! cmp -s "$UNIT_SRC" "$UNIT_DST"; then
    cp -p "$UNIT_DST" "$UNIT_BACKUP" 2>/dev/null || true
    log "systemd unit changed; installing $UNIT_DST and reloading"
    cp "$UNIT_SRC" "$UNIT_DST"
    systemctl daemon-reload
    unit_changed=true
  else
    log "systemd unit unchanged"
  fi
fi

# --- Restart ------------------------------------------------------------------
log "Restarting ${SERVICE}..."
systemctl restart "$SERVICE"

# --- Health check -------------------------------------------------------------
# 200 = fully healthy; 503 = process is up but the DB is degraded. Either means
# the Node process is serving, which is what a code deploy verifies. Only a
# connection failure (000) or an unexpected code counts as a failed deploy —
# rolling back code would not fix a database outage, so it must not trigger one.
health_code() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || echo "000"
}

log "Waiting for the app to become healthy (up to ${HEALTH_TIMEOUT}s)..."
healthy=""
for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
  code="$(health_code)"
  if [ "$code" = "200" ] || [ "$code" = "503" ]; then
    healthy="$code"
    break
  fi
  sleep 1
done

if [ -n "$healthy" ]; then
  log "Healthy (HTTP ${healthy}). Deployed ${NEW_COMMIT:0:7}."
  audit "SUCCESS" "$PREV_COMMIT" "$NEW_COMMIT" "$healthy"
  rm -f "$UNIT_BACKUP" 2>/dev/null || true
  exit 0
fi

# --- Rollback -----------------------------------------------------------------
log "Health check failed after restart. Rolling back to ${PREV_COMMIT:0:7}..."
git reset --hard "$PREV_COMMIT"
pnpm install --frozen-lockfile
pnpm build
# If this deploy installed a new unit, restore the previous one so the rollback
# reverts the unit alongside the code.
if [ "$unit_changed" = true ] && [ -f "$UNIT_BACKUP" ]; then
  log "restoring previous systemd unit"
  cp -p "$UNIT_BACKUP" "$UNIT_DST"
  systemctl daemon-reload
fi
systemctl restart "$SERVICE"

rb=""
for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
  code="$(health_code)"
  if [ "$code" = "200" ] || [ "$code" = "503" ]; then
    rb="$code"
    break
  fi
  sleep 1
done

if [ -n "$rb" ]; then
  log "Rollback OK; serving ${PREV_COMMIT:0:7} (HTTP ${rb}). Deploy FAILED."
  audit "FAILED_ROLLED_BACK" "$PREV_COMMIT" "$NEW_COMMIT" "$rb"
else
  log "CRITICAL: rollback did not restore the service. Manual intervention required."
  audit "CRITICAL_ROLLBACK_FAILED" "$PREV_COMMIT" "$NEW_COMMIT" ""
fi
rm -f "$UNIT_BACKUP" 2>/dev/null || true
exit 1
