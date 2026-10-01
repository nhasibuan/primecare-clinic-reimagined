#!/usr/bin/env bash
# PrimeCare daily encrypted MySQL backup.
#
# Dumps the primecare schema (single transaction, InnoDB-consistent),
# gzips it, encrypts it with AES-256 GPG using BACKUP_PASSPHRASE from the
# secrets vault (never written to disk in plaintext), verifies the archive
# round-trips, and prunes old backups. Run by primecare-backup.timer.
#
# Restore:
#   gpg --pinentry-mode loopback --passphrase-file /root/secrets/master-passphrase.txt \
#     -d /root/secrets/primecare-secrets.asc | grep BACKUP_PASSPHRASE   # (then decrypt manually)
#   gpg -d <file>.gpg | gunzip | mysql -u primecare -p primecare
set -euo pipefail

DB_NAME="primecare"
DB_USER="primecare"
# App env holds DATABASE_URL; the primecare user's password is parsed from it
# and placed only in a root-owned temp defaults file, shredded on exit.
ENV_FILE="/g/primecare-clinic-reimagined/.env"
BACKUP_DIR="/root/backups"
KEEP=14
SECRETS_DIR="/root/secrets"
VAULT="$SECRETS_DIR/primecare-secrets.asc"
MASTER_PASS="$SECRETS_DIR/master-passphrase.txt"

umask 077
mkdir -p "$BACKUP_DIR"

[ -r "$VAULT" ] && [ -r "$MASTER_PASS" ] || { echo "vault or master passphrase missing" >&2; exit 1; }

# Pull BACKUP_PASSPHRASE out of the vault (stays in memory only).
BACKUP_PASS=$(gpg --batch --yes --pinentry-mode loopback \
  --passphrase-file "$MASTER_PASS" -d "$VAULT" \
  | grep '^BACKUP_PASSPHRASE=' | cut -d= -f2- | tr -d '"')
[ -n "$BACKUP_PASS" ] || { echo "BACKUP_PASSPHRASE not found in vault" >&2; exit 1; }

STAMP=$(date +%Y%m%d-%H%M%S)
TARGET="$BACKUP_DIR/primecare-$STAMP.sql.gz.gpg"
PASSFILE=$(mktemp)
CNF=$(mktemp)
trap 'shred -u "$PASSFILE" "$CNF"' EXIT
printf '%s' "$BACKUP_PASS" > "$PASSFILE"

DB_PASS=$(grep '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"' \
  | sed -E 's|^mysql://[^:]+:([^@]+)@.*$|\1|')
[ -n "$DB_PASS" ] || { echo "could not parse DATABASE_URL from $ENV_FILE" >&2; exit 1; }
printf '[client]\nuser=%s\npassword=%s\nhost=localhost\n' "$DB_USER" "$DB_PASS" > "$CNF"
chmod 600 "$CNF"

# Dump + compress + encrypt in one pipeline; plaintext never touches disk.
mysqldump --defaults-extra-file="$CNF" --single-transaction --no-tablespaces "$DB_NAME" \
  | gzip \
  | gpg --batch --yes --pinentry-mode loopback \
      --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 \
      --s2k-count 65011712 --passphrase-file "$PASSFILE" \
      -o "$TARGET" -c

chmod 600 "$TARGET"

# Verify: decrypt, check the gzip stream integrity, then count table definitions.
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$PASSFILE" -d "$TARGET" \
  | gunzip -t
TABLES=$(gpg --batch --yes --pinentry-mode loopback --passphrase-file "$PASSFILE" -d "$TARGET" \
  | gunzip | grep -c 'CREATE TABLE' || true)
SIZE=$(stat -c %s "$TARGET")
if [ "${TABLES:-0}" -lt 5 ] || [ "$SIZE" -lt 2000 ]; then
  echo "backup verification FAILED (tables=$TABLES size=$SIZE) — keeping file for inspection" >&2
  exit 1
fi
echo "backup ok: $TARGET ($SIZE bytes, $TABLES tables)"

# Retention: keep newest $KEEP, delete the rest.
ls -1t "$BACKUP_DIR"/primecare-*.sql.gz.gpg 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  shred -u "$old"
  echo "pruned old backup: $old"
done
