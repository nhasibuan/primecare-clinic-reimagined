import { describe, expect, it } from "vitest";
import { resolveListenPort } from "./_core/listenPort";

/** Probe that reports every port in `taken` as unavailable. */
function probeWith(taken: number[]) {
  return async (port: number) => !taken.includes(port);
}

describe("resolveListenPort", () => {
  it("uses the preferred port when it is free", async () => {
    await expect(
      resolveListenPort({
        preferredPort: 3000,
        isProduction: true,
        probe: probeWith([]),
      })
    ).resolves.toBe(3000);
  });

  it("fails fast in production when the preferred port is taken", async () => {
    await expect(
      resolveListenPort({
        preferredPort: 3000,
        isProduction: true,
        probe: probeWith([3000]),
      })
    ).rejects.toThrow(/Port 3000 is already in use/);
  });

  it("never silently binds a different port in production", async () => {
    // 3001 is free, yet production must not drift onto it: the reverse proxy
    // and the deploy health check both target the preferred port.
    const probe = probeWith([3000]);
    await expect(
      resolveListenPort({ preferredPort: 3000, isProduction: true, probe })
    ).rejects.toThrow(/Refusing to start in production/);
  });

  it("walks forward to the next free port outside production", async () => {
    await expect(
      resolveListenPort({
        preferredPort: 3000,
        isProduction: false,
        probe: probeWith([3000, 3001]),
      })
    ).resolves.toBe(3002);
  });

  it("throws when the whole development scan range is exhausted", async () => {
    const taken = Array.from({ length: 20 }, (_, i) => 3000 + i);
    await expect(
      resolveListenPort({
        preferredPort: 3000,
        isProduction: false,
        probe: probeWith(taken),
        scanRange: 20,
      })
    ).rejects.toThrow(/No available port found/);
  });
});
