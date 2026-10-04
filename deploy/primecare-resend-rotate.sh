#!/usr/bin/env bash
# primecare-resend-rotate — rotate the Resend alert API key, self-service.
#
# Why: the alert channel lives or dies by this key, and rotation should
# never require pasting the new key into chat. Run this on the VM and the
# key goes straight from the Resend dashboard into the root-only env file
# and the GPG vault, with delivery proof at every step:
#   1. pre-flight: real send with the NEW key (must return HTTP 200)
#   2. atomic swap of /usr/local/lib/primecare-alert.env (chmod 600 kept)
#   3. post-swap proof: primecare_notify must log SENT in
#      /root/primecare-notify.log using the live file
#   4. GPG vault update with byte-verified round-trip
#      (AES256, S2K mode 3, SHA-512 — see SECRETS_RECOVERY.md)
#
# Usage (root, on the VM):
#   primecare-resend-rotate 're_NEW_API_KEY'
#   DRY_RUN=1 primecare-resend-rotate 're_NEW_API_KEY'   # pre-flight only, no writes
#
# After a successful rotation, revoke the OLD key in the Resend dashboard.
# The log makes the channel state self-proving: a dead/revoked key logs
# "FAIL rc=0 http=401" in /root/primecare-notify.log on the next send.

set -u

ENV_FILE="/usr/local/lib/primecare-alert.env"
NOTIFY_LIB="/usr/local/lib/primecare-notify.sh"
VAULT="/root/secrets/primecare-secrets.asc"
PASSFILE="/root/secrets/master-passphrase.txt"
LOG_FILE="/root/primecare-notify.log"
SENDER="onboarding@resend.dev"
DRY_RUN="${DRY_RUN:-0}"

fail() { echo "rotate: ERROR: $*" >&2; exit 1; }
info() { echo "rotate: $*"; }

[ "$(id -u)" -eq 0 ] || fail "must run as root"
[ $# -eq 1 ] || fail "usage: primecare-resend-rotate 're_NEW_API_KEY'   (or DRY_RUN=1 primecare-resend-rotate 're_...')"
NEW_KEY="$1"
printf '%s' "$NEW_KEY" | grep -Eq '^re_[A-Za-z0-9_-]{20,}$' \
  || fail "argument does not look like a Resend API key (expected re_...)"
[ -r "$ENV_FILE" ] || fail "missing $ENV_FILE"
[ -r "$NOTIFY_LIB" ] || fail "missing $NOTIFY_LIB"
[ -r "$PASSFILE" ] || fail "missing $PASSFILE"
[ -f "$VAULT" ] || fail "missing $VAULT"

OLD_KEY=$(grep '^RESEND_API_KEY=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"')
ALERT_TO=$(grep '^ALERT_EMAIL_TO=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '"')
[ -n "$OLD_KEY" ] && [ -n "$ALERT_TO" ] || fail "env file missing RESEND_API_KEY / ALERT_EMAIL_TO"
[ "$NEW_KEY" != "$OLD_KEY" ] || fail "new key equals the key already installed"

proof_tmp="/tmp/.rotate-proof.$$"
proof_err="$proof_tmp.err"

# --- 1) Pre-flight: prove the NEW key works before touching anything -----
info "pre-flight: sending proof email to $ALERT_TO with the NEW key ..."
code=$(curl -sS -o "$proof_tmp" -w '%{http_code}' --max-time 15 \
  -H "Authorization: Bearer $NEW_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"$SENDER\",\"to\":[\"$ALERT_TO\"],\"subject\":\"PrimeCare alert key rotation proof\",\"text\":\"Pre-flight send with the NEW key. If you see this, rotation is safe to apply.\"}" \
  https://api.resend.com/emails 2>"$proof_err")
rc=$?
body=$(tr '\n\t' '  ' < "$proof_tmp" 2>/dev/null | sed 's/^ *//' | head -c 200)
rm -f "$proof_tmp" "$proof_err"
if [ "$rc" -ne 0 ] || [ "$code" != "200" ]; then
  fail "new key failed pre-flight (curl rc=$rc http=$code) body=$body — nothing was changed"
fi
info "new key works (HTTP 200, proof email queued)"

if [ "$DRY_RUN" = "1" ]; then
  info "DRY_RUN=1 — stopping before any write. Re-run without DRY_RUN to apply."
  exit 0
fi

# --- 2) Atomic env-file swap ---------------------------------------------
tmp_env="$ENV_FILE.new.$$"
( umask 077 && printf 'RESEND_API_KEY=%s\nALERT_EMAIL_TO=%s\n' "$NEW_KEY" "$ALERT_TO" > "$tmp_env" ) \
  || fail "cannot write staging file $tmp_env"
chown root:root "$tmp_env" && chmod 600 "$tmp_env" \
  || { rm -f "$tmp_env"; fail "cannot set root-only perms on $tmp_env"; }
mv "$tmp_env" "$ENV_FILE" || fail "atomic swap of $ENV_FILE failed"
info "env file swapped (chmod 600 kept)"

# --- 3) Post-swap proof through the production lib -----------------------
. "$NOTIFY_LIB" || fail "cannot source $NOTIFY_LIB"
primecare_notify "PrimeCare alert key rotated" \
  "The alert channel now uses the new API key (this send went through the live env file). You can revoke the old key in the Resend dashboard now."
tail -n 2 "$LOG_FILE" 2>/dev/null | grep -q ' SENT ' \
  || fail "post-swap send did not log SENT — inspect $LOG_FILE before revoking the old key"
info "live channel verified with the new key (SENT logged)"

# --- 4) GPG vault update with byte-verified round-trip -------------------
info "updating GPG vault ..."
vtmp=$(mktemp /root/secrets/.rotate-manifest.XXXXXX)
vver=$(mktemp /root/secrets/.rotate-verify.XXXXXX)
vnew="$VAULT.new.$$"
cleanup() { shred -u "$vtmp" "$vver" 2>/dev/null; [ -f "$vnew" ] && shred -u "$vnew" 2>/dev/null; return 0; }
trap 'cleanup' EXIT

gpg --batch --yes --pinentry-mode loopback --passphrase-file "$PASSFILE" \
  -d -o "$vtmp" "$VAULT" 2>/dev/null \
  || fail "vault decrypt failed — vault untouched, but the env file is already swapped. Update the vault manually per SECRETS_RECOVERY.md."
chmod 600 "$vtmp"
if grep -q '^RESEND_API_KEY=' "$vtmp"; then
  sed -i "s|^RESEND_API_KEY=.*|RESEND_API_KEY=$NEW_KEY|" "$vtmp"
else
  printf '# Resend email alerts (watchdog downtime + Saturday 03:17 UTC weekly review)\nRESEND_API_KEY=%s\n' "$NEW_KEY" >> "$vtmp"
fi
grep -q '^ALERT_EMAIL_TO=' "$vtmp" || printf 'ALERT_EMAIL_TO=%s\n' "$ALERT_TO" >> "$vtmp"
sed -i "s|^# Updated: .*|# Updated: $(date -u +%FT%TZ) — RESEND_API_KEY rotated via primecare-resend-rotate|" "$vtmp"

gpg --batch --yes --pinentry-mode loopback --cipher-algo AES256 \
  --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 \
  --passphrase-file "$PASSFILE" -o "$vnew" -c "$vtmp" 2>/dev/null \
  || fail "vault re-encrypt failed — env file is swapped but the vault was NOT updated; retry the vault step"
chmod 600 "$vnew"
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$PASSFILE" \
  -d -o "$vver" "$vnew" 2>/dev/null \
  || fail "vault round-trip decrypt failed — vault NOT swapped"
cmp -s "$vtmp" "$vver" || fail "vault round-trip content mismatch — vault NOT swapped"
grep -q "^RESEND_API_KEY=$NEW_KEY\$" "$vver" || fail "new key not present in round-trip output — vault NOT swapped"
mv "$vnew" "$VAULT" || fail "cannot move verified vault into place"
chmod 600 "$VAULT"
info "vault updated and byte-verified"

trap - EXIT
info "DONE — rotation complete. Now revoke the OLD key in the Resend dashboard (API Keys)."
