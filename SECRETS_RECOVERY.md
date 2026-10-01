# Secrets Recovery — Key Custody & Emergency Procedures

Companion to `DEPLOYMENT_ROLLOUT.md`. This file documents **where production
secrets live on VM-17-99-ubuntu**, how to recover them, and what to do when
one is lost. It never contains the secrets themselves.

## Where secrets live (as of 2026-10-01)

| Secret | Live copy (runtime) | Recovery copy |
|--------|--------------------|----------------|
| `PII_ENCRYPTION_KEY` | `/g/primecare-clinic-reimagined/.env` | `/root/secrets/primecare-secrets.asc` |
| `JWT_SECRET` | `/g/primecare-clinic-reimagined/.env` | `/root/secrets/primecare-secrets.asc` |
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

### `PII_ENCRYPTION_KEY` lost
Recover it from the vault (above). If **both** the `.env` and the vault are
lost, encrypted patient fields (name, contact, NIK, birth data, notes) are
permanently unrecoverable — they will read as raw `v1:...` envelopes. There
is no backdoor by design. Restore from the offline master-passphrase copy.

### `JWT_SECRET` lost
No data loss. Sessions are invalidated; generate a new 64-char key
(`openssl rand -base64 48`), update `.env` and the vault, restart. Users just
sign in again.

### Vault master passphrase lost
The vault is unrecoverable — symmetric GPG has no reset. This is why the
offline copy below is mandatory.

### Whole VM lost
Restore from your offline master-passphrase copy plus the latest database
backup. Rebuild `.env` using this file and `DEPLOYMENT_ROLLOUT.md`; database,
OAuth, and Turnstile credentials come from your provider dashboards. The
pre-0009 backup at `/root/backup_pre_0009_2026-10-01.sql.gpg` needs
`BACKUP_PASSPHRASE` from the vault:
`gpg -d backup_pre_0009_2026-10-01.sql.gpg > dump.sql`.

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
`PII_ENCRYPTION_KEY` rotation requires re-encrypting every `v1:` envelope —
tooling is not built yet; open an issue before rotating.
