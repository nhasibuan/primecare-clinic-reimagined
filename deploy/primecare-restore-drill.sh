#!/usr/bin/env bash
# PrimeCare monthly restore drill.
#
# Proves the daily encrypted backups are actually restorable — the check the
# backup script itself cannot do. Restores the newest /root/backups archive
# into a scratch database, compares per-table row counts against production,
# and verifies patient PII still decrypts (AES-256-GCM auth tags intact) via
# scripts/restoreDrillCheck.mts. Then drops the scratch DB and revokes the
# grant. Run monthly by primecare-restore-drill.timer; report is written to
# /root/restore-drill-report.txt (latest run) and /root/restore-drill-history.log.
#
# Notes:
#   - Scratch DB needs GRANT ALL for 'primecare'@'localhost': the app user is
#     restricted to its own schema, so root creates/grants/drops here.
#   - Secrets (BACKUP_PASSPHRASE, DB password, PII_ENCRYPTION_KEY) are parsed
#     into root-owned temp files / environment and never written to disk in
#     plaintext; temp files are shredded on exit.
#   - No decrypted PII is ever printed — the decrypt check logs counts only.
set -uo pipefail

ENV_FILE="/g/primecare-clinic-reimagined/.env"
REPO_DIR="/g/primecare-clinic-reimagined"
BACKUP_DIR="/root/backups"
SECRETS_DIR="/root/secrets"
VAULT="$SECRETS_DIR/primecare-secrets.asc"
MASTER_PASS="$SECRETS_DIR/master-passphrase.txt"
REPORT="/root/restore-drill-report.txt"
HISTORY="/root/restore-drill-history.log"
PROD_DB="primecare"
DB_USER="primecare"
SCRATCH_DB="primecare_drill_$(date +%Y%m%d_%H%M%S)"

umask 077
PASSFILE=$(mktemp)
CNF=$(mktemp)
RESTORE_LOG=$(mktemp)
SCRATCH_EXISTS=0
FAILED=0

cleanup() {
  if [ "$SCRATCH_EXISTS" -eq 1 ]; then
    mysql -u root -e "DROP DATABASE IF EXISTS \`$SCRATCH_DB\`;" >/dev/null 2>&1 || true
    mysql -u root -e "DELETE FROM mysql.db WHERE Db='$SCRATCH_DB'; FLUSH PRIVILEGES;" >/dev/null 2>&1 || true
  fi
  shred -u "$PASSFILE" "$CNF" "$RESTORE_LOG" 2>/dev/null || true
}
trap cleanup EXIT

report() { printf '%s\n' "$*" >> "$REPORT"; }
die() { report "FAIL    $1"; exit 1; }

: > "$REPORT"
report "PrimeCare restore drill — $(date -u +%FT%TZ)"
report "scratch DB: $SCRATCH_DB"

# --- inputs ---------------------------------------------------------------
[ -r "$VAULT" ] && [ -r "$MASTER_PASS" ] || die "vault or master passphrase missing"

BACKUP_PASS=$(gpg --batch --yes --pinentry-mode loopback \
  --passphrase-file "$MASTER_PASS" -d "$VAULT" \
  | grep '^BACKUP_PASSPHRASE=' | cut -d= -f2- | tr -d '"')
[ -n "$BACKUP_PASS" ] || die "BACKUP_PASSPHRASE not found in vault"
printf '%s' "$BACKUP_PASS" > "$PASSFILE"

LATEST=$(ls -1t "$BACKUP_DIR"/primecare-*.sql.gz.gpg 2>/dev/null | head -n1)
[ -n "$LATEST" ] || die "no encrypted backups found in $BACKUP_DIR"

RAW_DB_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"')
DB_PASS=$(printf '%s' "$RAW_DB_URL" | sed -E 's|^mysql://[^:]+:([^@]+)@.*$|\1|')
[ -n "$DB_PASS" ] || die "could not parse DATABASE_URL from $ENV_FILE"
printf '[client]\nuser=%s\npassword=%s\nhost=localhost\n' "$DB_USER" "$DB_PASS" > "$CNF"
chmod 600 "$CNF"

PII_KEY=$(grep '^PII_ENCRYPTION_KEY=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"')
[ -n "$PII_KEY" ] || die "PII_ENCRYPTION_KEY not found in $ENV_FILE"

# --- scratch database ------------------------------------------------------
mysql -u root -e "SELECT 1;" >/dev/null 2>&1 || die "mysql root (socket auth) unavailable"
mysql -u root -e "CREATE DATABASE \`$SCRATCH_DB\`;" || die "could not create scratch DB"
SCRATCH_EXISTS=1
mysql -u root -e "GRANT ALL PRIVILEGES ON \`$SCRATCH_DB\`.* TO '${DB_USER}'@'localhost';" \
  || die "could not grant scratch DB rights to ${DB_USER}"
report "ok      scratch DB created, grant issued to ${DB_USER}"

# --- restore ---------------------------------------------------------------
report "restoring $(basename "$LATEST") → $SCRATCH_DB"
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$PASSFILE" -d "$LATEST" \
  | gunzip \
  | mysql --defaults-extra-file="$CNF" "$SCRATCH_DB" > "$RESTORE_LOG" 2>&1
RC=$?
[ "$RC" -eq 0 ] || die "restore pipeline failed (rc=$RC): $(tail -n 3 "$RESTORE_LOG")"
report "ok      restore completed"

# --- row counts vs production ----------------------------------------------
TABLES=$(mysql --defaults-extra-file="$CNF" -N -B \
  -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$PROD_DB' ORDER BY table_name;")
[ -n "$TABLES" ] || die "could not list tables of production schema '$PROD_DB'"

MISMATCH=0
COUNT=0
for t in $TABLES; do
  P=$(mysql --defaults-extra-file="$CNF" -N -B -e "SELECT COUNT(*) FROM \`$PROD_DB\`.\`$t\`;")
  S=$(mysql --defaults-extra-file="$CNF" -N -B -e "SELECT COUNT(*) FROM \`$SCRATCH_DB\`.\`$t\`;" 2>/dev/null)
  S=${S:-MISSING}
  COUNT=$((COUNT + 1))
  if [ "$P" = "$S" ]; then
    report "ok      $t: $P row(s)"
  else
    report "FAIL    $t: prod=$P restored=$S"
    MISMATCH=1
  fi
done
[ "$MISMATCH" -eq 0 ] || FAILED=1
report "ok      compared $COUNT table(s)" 

# --- PII decrypt check -------------------------------------------------------
DRILL_DB_URL=$(printf '%s' "$RAW_DB_URL" | sed -E "s|^(mysql://[^/]+)/[^?]+(\\?.*)?$|\1/$SCRATCH_DB|")
if (cd "$REPO_DIR" && DRILL_DATABASE_URL="$DRILL_DB_URL" PII_ENCRYPTION_KEY="$PII_KEY" \
    npx tsx scripts/restoreDrillCheck.mts >> "$REPORT" 2>&1); then
  report "ok      PII decrypt check passed"
else
  report "FAIL    PII decrypt check failed (see line above)"
  FAILED=1
fi

# --- cleanup -----------------------------------------------------------------
mysql -u root -e "DROP DATABASE IF EXISTS \`$SCRATCH_DB\`;" || die "could not drop scratch DB"
mysql -u root -e "DELETE FROM mysql.db WHERE Db='$SCRATCH_DB'; FLUSH PRIVILEGES;" \
  || die "could not revoke scratch grant"
SCRATCH_EXISTS=0
report "ok      scratch DB dropped, grant removed"

# --- verdict -----------------------------------------------------------------
STAMP=$(date -u +%FT%TZ)
if [ "$FAILED" -eq 0 ]; then
  report "RESULT: PASS"
  echo "$STAMP PASS $(basename "$LATEST")" >> "$HISTORY"
  exit 0
else
  report "RESULT: FAIL — inspect this report and journalctl -u primecare-restore-drill"
  echo "$STAMP FAIL $(basename "$LATEST")" >> "$HISTORY"
  exit 1
fi
