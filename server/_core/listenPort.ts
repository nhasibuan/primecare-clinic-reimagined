/**
 * Listen-port resolution.
 *
 * Development is forgiving: if the preferred port is busy (another dev server,
 * a leftover watcher) the app walks forward and binds the next free port, which
 * is convenient and harmless.
 *
 * Production is not. Silently binding a different port would leave the systemd
 * unit, the reverse proxy and `scripts/deploy.sh` health check all pointing at
 * the preferred port, where the *previous* process may still be serving: the
 * new build would appear healthy while never receiving traffic — a false-green
 * deploy that is far harder to notice than a failed restart. Production
 * therefore fails fast, loudly, and non-zero, so systemd's restart policy and
 * the deploy rollback both see a real failure.
 *
 * The probe is injected so the decision table is unit-testable without
 * binding real sockets.
 */

export interface ResolveListenPortOptions {
  /** Port requested by configuration (PORT, default 3000). */
  preferredPort: number;
  /** True when NODE_ENV=production. */
  isProduction: boolean;
  /** Returns true when the port can be bound. */
  probe: (port: number) => Promise<boolean>;
  /** How many consecutive ports to try outside production (default 20). */
  scanRange?: number;
}

export async function resolveListenPort({
  preferredPort,
  isProduction,
  probe,
  scanRange = 20,
}: ResolveListenPortOptions): Promise<number> {
  if (await probe(preferredPort)) return preferredPort;

  if (isProduction) {
    throw new Error(
      `Port ${preferredPort} is already in use. Refusing to start in production: ` +
        `binding another port would leave the reverse proxy and the deploy health ` +
        `check talking to the previous process. Stop the process holding the port ` +
        `(systemctl status primecare; ss -ltnp | grep :${preferredPort}) and restart.`
    );
  }

  for (let port = preferredPort + 1; port < preferredPort + scanRange; port++) {
    if (await probe(port)) return port;
  }

  throw new Error(
    `No available port found in ${preferredPort}–${preferredPort + scanRange - 1}.`
  );
}
