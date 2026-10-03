# Secrets Recovery — Key Custody & Emergency Procedures

Companion to `DEPLOYMENT_ROLLOUT.md`. This file documents **where production
secrets live on VM-17-99-ubuntu**, how to recover them, and what to do when
one is lost. It never contains the secrets themselves.

## Where secrets live (as of 2026-10-01)

| Secret | Live copy (runtime) | Recovery copy |
|--------|--------------------|----------------|
| `PII_ENCRYPTION_KEY` | `/g/primecare-clinic-reimagined/.env` | `/root/secrets/primecare-secrets.asc` |
| `PII_ENCRYPTION_KEYS` (rotation ring; first = primary) | `/g/primecare-clinic-reimagined/.env` | `/root/secrets/primecare-secrets.asc` |
| `JWT_SECRET` | `/g/primecare-clinic-reimagined/.env` | `/root/secrets/primecare-secrets.asc` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` | `/g/primecare-clinic-reimagined/.env` | `/root/secrets/primecare-secrets.asc` |
| Backup passphrase (pre-0009 SQL dump) | — (only in the vault) | `/root/secrets/primecare-secrets.asc` |
| Vault master passphrase | `/root/secrets/master-passphrase.txt` | **Your offline copy — mandatory, see below** |

Properties of the vault:

- `/root/secrets/` is `chmod 700`; all files inside are `chmod 600`, root-only.
- `primecare-secrets.asc` is a symmetric GPG vault (AES-256, iterated SHA-512
  S2K). There is no key file to import — the master passphrase is the only
  credential.
- The `.env` is the live copy; the manifest inside the vault is the recovery
  copy. Values were verified identical at creation time.

## Reading the vault

```bash
sudo cat /root/secrets/master-passphrase.txt
sudo gpg --pinentry-mode loopback \
  --passphrase-file /root/secrets/master-passphrase.txt \
  -d /root/secrets/primecare-secrets.asc
```

Never paste the output into tickets, chat, or screenshots. If you need the
value in a file, write it to a `chmod 600` temp file and `shred -u` it when
done.

## Restoring a secret into `.env`

```bash
sudo gpg --pinentry-mode loopback \
  --passphrase-file /root/secrets/master-passphrase.txt \
  -d /root/secrets/primecare-secrets.asc > /root/secrets/.restore.tmp
chmod 600 /root/secrets/.restore.tmp
# copy the needed KEY="value" line into /g/primecare-clinic-reimagined/.env
shred -u /root/secrets/.restore.tmp
# tsx watch does not reload .env — restart the server, then:
curl -fsS http://localhost:3000/healthz
```

## Recovery scenarios

### `PII_ENCRYPTION_KEY` / `PII_ENCRYPTION_KEYS` lost
Recover the key(s) from the vault (above) — if a ring was in use, restore
**every** entry, since ciphertext written under a retired key needs that key
to decrypt. If **both** the `.env` and the vault are lost, encrypted patient
fields (name, contact, NIK, birth data, notes) are permanently unrecoverable
— they will read as raw `v1:...` envelopes. There is no backdoor by design.
Restore from the offline master-passphrase copy.

### `JWT_SECRET` lost
No data loss. Sessions are invalidated; generate a new 64-char key
(`openssl rand -base64 48`), update `.env` and the vault, restart. Users just
sign in again.

### Admin password lost
The vault stores only the **hash** (`ADMIN_PASSWORD_HASH`) — passwords are
never recoverable by design. Generate a new one and redeploy it:

```bash
node scripts/hashPassword.mjs 'new-passphrase'
# put the printed ADMIN_PASSWORD_HASH into .env (keep ADMIN_USERNAME), then
sudo systemctl restart primecare
```

Update the vault copy afterwards (see "Adding or rotating a secret").

### Vault master passphrase lost
The vault is unrecoverable — symmetric GPG has no reset. This is why the
offline copy below is mandatory.

### Whole VM lost
Restore from your offline master-passphrase copy plus the latest database
backup. Daily encrypted dumps live in `/root/backups/` (14-day retention);
each needs `BACKUP_PASSPHRASE` from the vault:
`gpg -d <file>.sql.gz.gpg | gunzip | mysql -u primecare -p primecare`.
The pre-0009 backup at `/root/backup_pre_0009_2026-10-01.sql.gpg` uses the
same passphrase: `gpg -d backup_pre_0009_2026-10-01.sql.gpg > dump.sql`.
Rebuild `.env` using this file and `DEPLOYMENT_ROLLOUT.md`; database and
Turnstile credentials come from your provider dashboards.

## Mandatory offline backup (do this now)

1. Write the master passphrase on paper (or a password manager). Store it
   with the same care as the PII key itself — losing both copies means losing
   the vault.
2. Optionally copy `primecare-secrets.asc` to an encrypted USB drive kept
   off-site.
3. Verify the offline copy once: decrypt the vault from another machine using
   only the paper passphrase.

## Adding or rotating a secret

1. Update the value in `.env`.
2. Rebuild the vault (keep perms 600, shred temps):
   ```bash
   gpg --batch --yes --pinentry-mode loopback --cipher-algo AES256 \
     --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 \
     --passphrase-file /root/secrets/master-passphrase.txt \
     -o /root/secrets/primecare-secrets.asc -c /root/secrets/.manifest.tmp
   ```
3. Restart the server and verify `/healthz`.

Rotation caveats: `JWT_SECRET` can be rotated anytime (sessions reset).
`PII_ENCRYPTION_KEY` rotation is supported — see "Rotating the PII encryption key" below.

### Rotating the PII encryption key

The app reads a key **ring**: `PII_ENCRYPTION_KEYS` is comma-separated, the
FIRST entry is the primary key used for encryption, and the rest are retired
keys kept so old ciphertext still decrypts (`server/encryption.ts` tries each
ring key in order). `PII_ENCRYPTION_KEY` remains the legacy single-key form.

1. Generate the new key (64 chars): `openssl rand -base64 48`.
2. Prepend it to the ring in `.env` — keep the old key for decryption:
   `PII_ENCRYPTION_KEYS="<new-key>,<old-key>"`.
3. Restart the server and verify `/healthz`. New writes now use the new key;
   old rows still decrypt via the retired key.
4. Re-encrypt every PII envelope with the new primary (idempotent — safe to
   re-run after an interruption):
   `PII_ENCRYPTION_KEYS="<new-key>,<old-key>" npx tsx scripts/rotatePiiKey.ts`
   The script refuses to run unless at least two keys are present, self-tests
   the primary key first, skips rows already on the new key, and leaves any
   undecryptable field untouched (exits 2 so failures are visible).
5. Re-run the script to confirm convergence (expect `0 row(s) rotated`).
6. Update the vault manifest with the new ring ("Adding or rotating a secret"
   above). Once every row is rotated you may drop the old key from the ring
   and restart — but there is no hurry: keeping it is harmless.
7. Break-glass: if the new key is lost before rotation finishes, the old key
   still decrypts everything while it remains in the ring. If ALL keys are
   lost, encrypted fields are permanently unrecoverable (no backdoor).
