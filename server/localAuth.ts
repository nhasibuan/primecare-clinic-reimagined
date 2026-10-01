/**
 * Self-hosted admin authentication.
 *
 * Single-owner alternative to external OAuth: credentials come from the
 * environment (ADMIN_USERNAME + ADMIN_PASSWORD_HASH, produced by
 * scripts/hashPassword.mjs), passwords are verified with scrypt in constant
 * time, login attempts are sliding-window rate-limited per client IP, and a
 * successful login reuses the exact session machinery the OAuth flow uses
 * (users table row + signed JWT cookie), so every tRPC-protected route keeps
 * working unchanged.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { z } from "zod";
import { ONE_YEAR_MS } from "@shared/const";
import { getClientIp } from "./appointmentRequest";
import { ENV } from "./_core/env";
import { getSessionCookieName, getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { recordAuditLog } from "./auditLog";
import { createRateLimiter } from "./rateLimiterFactory";
import { getUserByOpenId, upsertUser } from "./repositories/userRepository";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1 } as const;
const SCRYPT_KEYLEN = 64;
// 128 MiB headroom for N=2^15, r=8 (needs ~32 MiB per hash).
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

export const LOCAL_ADMIN_OPEN_ID = "local-admin";
export const LOCAL_ADMIN_NAME = "Clinic Owner";

/** Sliding window: 5 attempts per minute per client IP. */
export const loginRateLimiter = createRateLimiter(
  { maxRequests: 5, windowMs: 60_000 },
  "admin-login",
);

export const loginRequestSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Whether production login should use the self-hosted flow. */
export function isLocalAuthEnabled(): boolean {
  return Boolean(ENV.adminUsername && ENV.adminPasswordHash);
}

/**
 * Hash a password for ADMIN_PASSWORD_HASH.
 * Format: scrypt$N$r$p$<salt b64>$<hash b64> — parameters are embedded so
 * future upgrades can verify legacy hashes while writing stronger ones.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT_KEYLEN, {
    ...SCRYPT_PARAMS,
    maxmem: SCRYPT_MAXMEM,
  });
  return [
    "scrypt",
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

/** Length-independent comparison for two byte strings. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still burn a comparison to keep the timing profile uniform.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a password against a stored hash. Self-describing format: parses the
 * embedded parameters instead of assuming today's SCRYPT_PARAMS.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [tag, nStr, rStr, pStr, saltB64, hashB64] = parts;
  if (tag !== "scrypt") return false;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N < 2 || N > 1 << 21 || r < 1 || p < 1) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltB64, "base64");
    expected = Buffer.from(hashB64, "base64");
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length < 32) return false;
  try {
    const actual = await scrypt(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_MAXMEM,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export type LoginAttempt =
  | { ok: true }
  | { ok: false; reason: "rate_limited"; retryAfterMs: number }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "invalid_credentials" };

/**
 * Core credential check. Side-effect free (no cookie, no audit) so it is
 * directly unit-testable; the route handler layers HTTP concerns on top.
 */
export async function attemptLocalLogin(
  input: LoginRequest,
  clientIp: string,
  now: number = Date.now(),
): Promise<LoginAttempt> {
  const limit = await loginRateLimiter.attempt(`login:${clientIp}`, now);
  if (!limit.allowed) {
    return { ok: false, reason: "rate_limited", retryAfterMs: limit.retryAfterMs };
  }

  if (!isLocalAuthEnabled()) return { ok: false, reason: "not_configured" };

  const usernameOk = timingSafeEqualString(input.username, ENV.adminUsername);
  const passwordOk = await verifyPassword(input.password, ENV.adminPasswordHash);
  if (!usernameOk || !passwordOk) {
    return { ok: false, reason: "invalid_credentials" };
  }
  return { ok: true };
}

/**
 * Express handler: POST /api/auth/login.
 * Creates/updates the local admin user row, signs the same session cookie the
 * OAuth flow uses, and records the attempt in the audit log.
 */
export async function handleLocalLogin(req: Request, res: Response): Promise<void> {
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const clientIp = getClientIp(req);
  const result = await attemptLocalLogin(parsed.data, clientIp);

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
      res.set("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: `Too many login attempts. Try again in ${retryAfterSec}s.`,
      });
      return;
    }
    if (result.reason === "not_configured") {
      res.status(503).json({ error: "Admin login is not configured on this server." });
      return;
    }
    await recordAuditLog({
      actorId: null,
      action: "auth.login",
      entityType: "session",
      detail: "failed login attempt (invalid credentials)",
      ipAddress: clientIp,
    });
    // Uniform error: never reveal whether the username or password was wrong.
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  await upsertUser({
    openId: LOCAL_ADMIN_OPEN_ID,
    name: LOCAL_ADMIN_NAME,
    loginMethod: "local",
    lastSignedIn: new Date(),
    role: "admin",
  });

  const sessionToken = await sdk.createSessionToken(LOCAL_ADMIN_OPEN_ID, {
    name: LOCAL_ADMIN_NAME,
    expiresInMs: ONE_YEAR_MS,
  });

  res.cookie(getSessionCookieName(), sessionToken, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });

  const admin = await getUserByOpenId(LOCAL_ADMIN_OPEN_ID);
  await recordAuditLog({
    actorId: admin?.id ?? null,
    action: "auth.login",
    entityType: "session",
    detail: "admin login (local password auth)",
    ipAddress: clientIp,
  });

  res.json({ success: true });
}
