# Production Rollout — Security Hardening & PII Encryption

Deploy guide for commit `8f9ce87` (*feat: harden rate limiting and PII encryption*).
Read this end-to-end before deploying; the order of steps matters because the
new server **refuses to start** in production without `PII_ENCRYPTION_KEY`.

## What changed operationally

| Change | Impact on production |
|--------|---------------------|
| `PII_ENCRYPTION_KEY` now **required** | Startup fails fast if missing or shorter than 32 chars |
| Migration `0009` widens 9 columns | Must run **before** the new code writes encrypted rows |
| Session cookie renamed (`__Host-` prefix) | All users are signed out once; they just log in again |
| Rate limiter is now async | No action; behavior is identical, limits are stricter at window edges |
| Optional `REDIS_URL` | Only needed for multi-instance deployments |
| Optional `ALLOW_PLAINTEXT_PII` | Transitional escape hatch; do not set unless migrating |

## Step 0 — Read the warning boundaries

- **Never** set `TURNSTILE_ALLOW_TEST_KEY=true` in production (bypasses CAPTCHA).
- **Never** set `ALLOW_PLAINTEXT_PII=true` except as a short-lived migration
  measure — it stores patient NIK and contact data unencrypted and logs a loud
  warning while active.

## Step 1 — Generate and store the encryption key

```bash
openssl rand -base64 48
```

Store the output in your secrets manager (Vault, AWS Secrets Manager, etc.).
If this key is lost, encrypted patient data becomes unrecoverable — treat it
with the same care as the database itself. Do not commit it anywhere.

## Step 2 — Back up the database

```bash
mysqldump --single-transaction <database> > backup_pre_0009_$(date +%F).sql
```

Verify the dump file exists and is non-trivial in size before continuing.

## Step 3 — Apply migration 0009 (widen PII columns)

```bash
pnpm db:push
```

This runs `drizzle/0009_widen-encrypted-pii-columns.sql`: nine `ALTER TABLE`
statements widening `appointment_requests` (fullName, contactNumber, note,
nik, tempatLahir, tanggalLahir, alamatLengkap, email) and
`queue_entries.patientName`. Widening a varchar in MySQL 8 is an in-place
metadata change — no table rebuild, no data rewrite, safe on live traffic.
Apply it **before** deploying the new server code.

## Step 4 — Set the new environment variables

Add to the production environment (alongside the existing variables):

```
PII_ENCRYPTION_KEY=<output of step 1>
# Optional, multi-instance deployments only:
REDIS_URL=redis://<host>:6379
# Transitional only — avoid:
# ALLOW_PLAINTEXT_PII=true
```

The startup validator (`server/_core/env.ts`) now blocks the launch when
`PII_ENCRYPTION_KEY` is missing or under 32 characters. If a launch is truly
blocked during a migration window, set `ALLOW_PLAINTEXT_PII=true`
temporarily, then remove it and restart once the key is provisioned — the
server logs a warning the whole time that flag is active.

## Step 5 — Deploy and verify

```bash
pnpm build
NODE_ENV=production node dist/index.js
```

Verification checklist:

- [ ] Server starts without the production-environment validation error.
- [ ] `GET /healthz` returns `{"status":"ok","db":"connected",...}`.
- [ ] Log in to `/admin` (expect one fresh sign-in; the cookie name changed).
- [ ] Submit a test appointment through the public form; confirm it appears
      in the CMS queue.
- [ ] Spot-check in MySQL that `appointment_requests.fullName` and
      `contactNumber` are stored as `v1:...` envelopes, not plaintext.
- [ ] Verify the decrypted values render correctly in the CMS detail view.
- [ ] Submit until the rate limit trips (4th request within 60s from one IP)
      and confirm the `TOO_MANY_REQUESTS` message appears.
- [ ] If `REDIS_URL` was set, confirm the log line
      `Distributed rate limiting enabled via REDIS_URL` appeared at startup.

## Rollback

1. Stop the new server; start the previous build (old code reads and writes
   plaintext normally; it ignores the widened columns).
2. The widened columns and `PII_ENCRYPTION_KEY` can stay in place — older
   code doesn't reference them.
3. Rows encrypted by the new code will read as raw `v1:...` envelopes under
   the old code. Identify them with
   `SELECT id FROM appointment_requests WHERE fullName LIKE 'v1:%';`
   — decrypt offline using the same key, or re-enter those rows.
4. Migration 0009 does not need to be reverted; the wider columns are
   backward-compatible with the previous code.

## Key management going forward

- **Key custody & recovery:** see `SECRETS_RECOVERY.md` — the PII key and
  JWT secret are stored in a root-only GPG vault at `/root/secrets/` on the
  VM, plus a mandatory offline master-passphrase backup.
- The envelope format is versioned (`v1:`) for future key rotation; rotation
  tooling is not built yet — open an issue before rotation becomes urgent.
- Backups contain ciphertext; their security reduces to custody of
  `PII_ENCRYPTION_KEY`. Keep key and database backups under separate access
  controls.
- If `REDIS_URL` is set and Redis becomes unreachable, rate limiting fails
  open (per-instance in-memory behavior) with throttled warnings in the logs
  — watch for `Redis rate limiter degraded` entries.
