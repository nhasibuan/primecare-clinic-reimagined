import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

/**
 * HTTP-level tests for POST /api/auth/login (self-hosted admin login).
 * ENV, the rate limiter, and the DB-backed repositories are mocked so the
 * express handler is exercised end-to-end without a database or supertest.
 */

const mockEnv = vi.hoisted(() => ({
  adminUsername: "norman",
  adminPasswordHash: "",
  isProduction: true,
}));

vi.mock("./_core/env", () => ({ ENV: mockEnv }));

const mockAttempt = vi.hoisted(() => vi.fn());
vi.mock("./rateLimiterFactory", () => ({
  createRateLimiter: () => ({ attempt: mockAttempt, reset: () => {} }),
}));

const recordAuditLog = vi.hoisted(() => vi.fn());
vi.mock("./auditLog", () => ({ recordAuditLog }));

const upsertUser = vi.hoisted(() => vi.fn());
const getUserByOpenId = vi.hoisted(() => vi.fn());
vi.mock("./repositories/userRepository", () => ({
  upsertUser,
  getUserByOpenId,
}));

const createSessionToken = vi.hoisted(() => vi.fn());
vi.mock("./_core/sdk", () => ({
  sdk: { createSessionToken },
}));

import { handleLocalLogin, hashPassword } from "./localAuth";

const PASSWORD = "smoke-test-passphrase";

type MockRes = Response & {
  statusCode?: number;
  body?: unknown;
  cookies: Record<string, { value: string; options?: Record<string, unknown> }>;
  headers: Record<string, unknown>;
};

function makeReq(body: unknown, ip = "203.0.113.9"): Request {
  return {
    body,
    ip,
    socket: { remoteAddress: ip },
    headers: {},
  } as unknown as Request;
}

function makeRes(): MockRes {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    cookies: {} as MockRes["cookies"],
    headers: {} as MockRes["headers"],
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    cookie(name: string, value: string, options?: Record<string, unknown>) {
      res.cookies[name] = { value, options };
      return res;
    },
    clearCookie() {
      return res;
    },
    set(name: string, value: unknown) {
      res.headers[name] = value;
      return res;
    },
  };
  return res as unknown as MockRes;
}

describe("POST /api/auth/login handler", () => {
  beforeEach(async () => {
    mockEnv.adminPasswordHash = await hashPassword(PASSWORD);
    mockAttempt
      .mockReset()
      .mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    upsertUser.mockReset().mockResolvedValue(undefined);
    getUserByOpenId
      .mockReset()
      .mockResolvedValue({ id: 1, openId: "local-admin" });
    createSessionToken.mockReset().mockResolvedValue("signed.jwt.token");
    recordAuditLog.mockReset().mockResolvedValue(undefined);
  });

  it("sets the session cookie and returns success for valid credentials", async () => {
    const req = makeReq({ username: "norman", password: PASSWORD });
    const res = makeRes();
    await handleLocalLogin(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    const cookieName = Object.keys(res.cookies)[0];
    expect(cookieName).toMatch(/app_session_id$/);
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "local-admin", role: "admin" })
    );
    expect(createSessionToken).toHaveBeenCalledWith(
      "local-admin",
      expect.anything()
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login",
        detail: expect.stringContaining("local password"),
      })
    );
  });

  it("returns 401 with a uniform message for wrong credentials", async () => {
    const req = makeReq({ username: "norman", password: "wrong" });
    const res = makeRes();
    await handleLocalLogin(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid username or password." });
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login",
        detail: expect.stringContaining("failed"),
      })
    );
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    mockAttempt.mockResolvedValueOnce({ allowed: false, retryAfterMs: 45_000 });
    const req = makeReq({ username: "norman", password: PASSWORD });
    const res = makeRes();
    await handleLocalLogin(req, res);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("45");
    expect((res.body as { error: string }).error).toMatch(
      /Too many login attempts/
    );
  });

  it("returns 400 for malformed bodies", async () => {
    const res = makeRes();
    await handleLocalLogin(makeReq({ user: "x" }), res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 503 when local auth is not configured", async () => {
    mockEnv.adminUsername = "";
    mockEnv.adminPasswordHash = "";
    const res = makeRes();
    await handleLocalLogin(
      makeReq({ username: "norman", password: PASSWORD }),
      res
    );
    expect(res.statusCode).toBe(503);
  });
});
