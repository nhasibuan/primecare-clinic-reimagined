import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Local admin auth tests.
 *
 * ENV is mocked so the credential checks run against controlled values;
 * production-env validation is tested with fresh module loads (vi.resetModules)
 * because ENV is parsed at import time.
 */

const mockEnv = vi.hoisted(() => ({
  adminUsername: "",
  adminPasswordHash: "",
  oAuthServerUrl: "",
  isProduction: false,
}));

vi.mock("./_core/env", () => ({ ENV: mockEnv }));

const mockAttempt = vi.hoisted(() => vi.fn());
vi.mock("./rateLimiterFactory", () => ({
  createRateLimiter: () => ({ attempt: mockAttempt, reset: () => {} }),
}));

vi.mock("./auditLog", () => ({ recordAuditLog: vi.fn() }));

import {
  attemptLocalLogin,
  hashPassword,
  loginRequestSchema,
  timingSafeEqualString,
  verifyPassword,
} from "./localAuth";

const REAL_IP = "203.0.113.9";

async function configureCreds(username: string, password: string) {
  mockEnv.adminUsername = username;
  mockEnv.adminPasswordHash = await hashPassword(password);
}

describe("password hashing", () => {
  it("round-trips a password through hash/verify", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    await expect(
      verifyPassword("correct horse battery staple", hash)
    ).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password entirely", hash)).resolves.toBe(
      false
    );
  });

  it("rejects tampered and malformed hashes", async () => {
    const hash = await hashPassword("some password");
    const tampered = hash.replace(/.{8}$/, "AAAAAAAA");
    await expect(verifyPassword("some password", tampered)).resolves.toBe(
      false
    );
    await expect(verifyPassword("x", "not-a-valid-hash")).resolves.toBe(false);
    await expect(verifyPassword("x", "")).resolves.toBe(false);
  });
});

describe("timingSafeEqualString", () => {
  it("matches equal strings and rejects differing ones", () => {
    expect(timingSafeEqualString("norman", "norman")).toBe(true);
    expect(timingSafeEqualString("norman", "attacker")).toBe(false);
    expect(timingSafeEqualString("short", "longer-string")).toBe(false);
  });
});

describe("attemptLocalLogin", () => {
  beforeEach(() => {
    mockEnv.adminUsername = "";
    mockEnv.adminPasswordHash = "";
    mockAttempt.mockReset();
    mockAttempt.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  });

  it("accepts valid credentials", async () => {
    await configureCreds("norman", "s3cret-passphrase!");
    const result = await attemptLocalLogin(
      { username: "norman", password: "s3cret-passphrase!" },
      REAL_IP
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects wrong credentials without revealing which part failed", async () => {
    await configureCreds("norman", "s3cret-passphrase!");
    const wrongPassword = await attemptLocalLogin(
      { username: "norman", password: "nope" },
      REAL_IP
    );
    const wrongUser = await attemptLocalLogin(
      { username: "who", password: "s3cret-passphrase!" },
      REAL_IP
    );
    expect(wrongPassword).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(wrongUser).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("reports not_configured when credentials are absent", async () => {
    const result = await attemptLocalLogin(
      { username: "x", password: "y" },
      REAL_IP
    );
    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });

  it("rate-limits by client IP before checking credentials", async () => {
    await configureCreds("norman", "s3cret-passphrase!");
    mockAttempt.mockResolvedValueOnce({ allowed: false, retryAfterMs: 30_000 });
    const result = await attemptLocalLogin(
      { username: "norman", password: "s3cret-passphrase!" },
      REAL_IP
    );
    expect(result).toEqual({
      ok: false,
      reason: "rate_limited",
      retryAfterMs: 30_000,
    });
    expect(mockAttempt).toHaveBeenCalledWith(
      `login:${REAL_IP}`,
      expect.any(Number)
    );
  });
});

describe("loginRequestSchema", () => {
  it("rejects empty and oversized inputs", () => {
    expect(
      loginRequestSchema.safeParse({ username: "", password: "x" }).success
    ).toBe(false);
    expect(
      loginRequestSchema.safeParse({ username: "u", password: "" }).success
    ).toBe(false);
    expect(
      loginRequestSchema.safeParse({ username: "u".repeat(101), password: "x" })
        .success
    ).toBe(false);
    expect(
      loginRequestSchema.safeParse({ username: "u", password: "p".repeat(201) })
        .success
    ).toBe(false);
  });
});

describe("validateProductionEnv — local auth path", () => {
  const saved = { NODE_ENV: process.env.NODE_ENV };

  afterAll(() => {
    process.env.NODE_ENV = saved.NODE_ENV;
  });

  async function freshValidate(envOverrides: Record<string, string>) {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    Object.assign(process.env, {
      JWT_SECRET: "x".repeat(48),
      DATABASE_URL: "mysql://u:p@localhost/primecare",
      PII_ENCRYPTION_KEY: "y".repeat(48),
      OWNER_OPEN_ID: "",
      OAUTH_SERVER_URL: "",
      ADMIN_USERNAME: "",
      ADMIN_PASSWORD_HASH: "",
      ...envOverrides,
    });
    // Bypass the file-level ENV mock: we need the real module to parse the
    // process.env values we just set.
    const actual =
      await vi.importActual<typeof import("./_core/env")>("./_core/env");
    return actual.validateProductionEnv;
  }

  it("passes with local admin credentials even without OAuth config", async () => {
    const validate = await freshValidate({
      ADMIN_USERNAME: "norman",
      ADMIN_PASSWORD_HASH: "scrypt$32768$8$1$aaaa$bbbb",
    });
    expect(() => validate()).not.toThrow();
  });

  it("fails without any auth path configured", async () => {
    const validate = await freshValidate({});
    expect(() => validate()).toThrow(
      /OWNER_OPEN_ID.*OAUTH_SERVER_URL|OAUTH_SERVER_URL[\s\S]*OWNER_OPEN_ID|self-hosted/
    );
  });

  it("still passes for the pure OAuth path", async () => {
    const validate = await freshValidate({
      OWNER_OPEN_ID: "owner-123",
      OAUTH_SERVER_URL: "https://forge.manus.ai",
    });
    expect(() => validate()).not.toThrow();
  });

  it("rejects a password hash that is not in the scrypt$ format", async () => {
    const validate = await freshValidate({
      ADMIN_USERNAME: "norman",
      ADMIN_PASSWORD_HASH: "plaintext-not-a-hash",
    });
    expect(() => validate()).toThrow(/ADMIN_PASSWORD_HASH/);
  });
});
