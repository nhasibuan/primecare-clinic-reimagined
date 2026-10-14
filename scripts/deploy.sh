#!/usr/bin/env bash
#
# Production deploy for PrimeCare Clinic (primecare.service).
#
# Pulls the exact state of origin/<branch>, installs dependencies, rebuilds,
# restarts the systemd service, and verifies the app is serving. On a failed
# health check it rolls back to the previously running commit.
#
# Invoked over SSH by .github/workflows/deploy.yml. Must run as a user that can
# restart primecare.service (root, or a user with passwordless sudo).

set -euo pipefail

# --- Config -------------------------------------------------------------------
APP_DIR="/g/primecare-clinic-reimagined"
SERVICE="primecare.service"
BRANCH="main"
HEALTH_URL="http://localhost:3000/healthz"
HEALTH_TIMEOUT=30 # seconds to wait for the app to come up after restart

# Non-interactive SSH has a minimal PATH; make sure the toolchain is found.
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"

log() { echo "[deploy] $*"; }

cd "$APP_DIR"

# --- Safety: never deploy over uncommitted local changes ----------------------
if [ -n "$(git status --porcelain)" ]; then
  log "ERROR: working tree is not clean; refusing to deploy."
  git status --short
  exit 1
fi

PREV_COMMIT="$(git rev-parse HEAD)"
log "Currently running: ${PREV_COMMIT:0:7}"

# --- Pull the exact state of origin/<branch> ----------------------------------
log "Fetching origin/${BRANCH}..."
git fetch origin "$BRANCH"
# reset --hard (not pull): the VM is production and must mirror origin/main
# exactly, with no merge or divergence. The clean-tree check above guarantees
# nothing local is lost.
git reset --hard "origin/$BRANCH"
NEW_COMMIT="$(git rev-parse HEAD)"
log "Deploying: ${NEW_COMMIT:0:7}"

# --- Install + build ----------------------------------------------------------
log "Installing dependencies (frozen lockfile)..."
pnpm install --frozen-lockfile

log "Building..."
pnpm build

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
  exit 0
fi

# --- Rollback -----------------------------------------------------------------
log "Health check failed after restart. Rolling back to ${PREV_COMMIT:0:7}..."
git reset --hard "$PREV_COMMIT"
pnpm install --frozen-lockfile
pnpm build
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
else
  log "CRITICAL: rollback did not restore the service. Manual intervention required."
fi
exit 1
