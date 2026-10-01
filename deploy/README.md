# Production Deployment (systemd)

Templates and docs for moving the site from `pnpm dev` (tsx watch) to a
production systemd service. **Do not execute the cutover until the production
environment is complete** — `NODE_ENV=production` makes startup fail-fast on
missing `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, and `BUILT_IN_FORGE_API_URL`, and
the current admin login depends on the dev backdoor (`/api/dev/login`).

## Prerequisites checklist

- [ ] Real OAuth credentials configured in `.env`
      (`OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`,
      `BUILT_IN_FORGE_API_KEY`) and admin login verified through the real
      OAuth flow, not `/api/dev/login`.
- [ ] Real Turnstile keys in `.env` (`TURNSTILE_SITE_KEY`,
      `TURNSTILE_SECRET_KEY`) and `TURNSTILE_ALLOW_TEST_KEY` removed or set
      to `false` (it currently bypasses CAPTCHA on the public tunnel).
- [ ] `PII_ENCRYPTION_KEY` and `JWT_SECRET` present — see
      `SECRETS_RECOVERY.md` for custody.
- [ ] Production build verified: `pnpm build` succeeds.
- [ ] `deploy/primecare.service` reviewed: `WorkingDirectory`,
      `EnvironmentFile`, and `User` match this VM's paths.

## Cutover runbook

1. `pnpm build`
2. Quick smoke test of the exact artifact systemd will run:
   `NODE_ENV=production PORT=3001 node dist/index.js` then
   `curl -fsS http://localhost:3001/healthz` — must return
   `{"status":"ok","db":"connected",...}`. Stop the test process.
3. In the terminal running `pnpm dev`, stop the dev server (Ctrl-C).
4. `sudo cp deploy/primecare.service /etc/systemd/system/`
5. `sudo systemctl daemon-reload && sudo systemctl enable --now primecare`
6. Verify:
   - `systemctl status primecare` — active (running)
   - `curl -fsS http://localhost:3000/healthz`
   - Public site loads through the Cloudflare tunnel; admin login works via
     real OAuth; CAPTCHA is enforced on the appointment form.
7. Confirm the unit survives reboot:
   `sudo reboot` (at a quiet time), then re-check `/healthz`.

## Rollback

```bash
sudo systemctl disable --now primecare
# from the repo:
pnpm dev
```

The dev entrypoint is unchanged, so reverting takes seconds. Any sessions
created under production survive (same `.env`), only uptime is lost.

## Notes

- The unit starts `node dist/index.js` directly — no tsx, no watch. Server
  code changes require `pnpm build && sudo systemctl restart primecare`.
  `.env` changes only require the restart (same as today's behavior).
- Rate limiting stays per-instance in-memory unless `REDIS_URL` is set.
- Hardening lines in the unit (`NoNewPrivileges`, etc.) are conservative; if
  a dedicated service user is introduced later, re-check access to `.env`,
  `/root/secrets`, and the MySQL socket.
