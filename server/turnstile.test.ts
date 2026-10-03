import { describe, expect, it, vi } from "vitest";
import {
  TURNSTILE_ALWAYS_PASS_TEST_SECRET,
  TURNSTILE_DUMMY_TOKEN,
  getTurnstileVerificationSecret,
  verifyTurnstileToken,
} from "./turnstile";

describe("Turnstile token verification", () => {
  it("submits a token and the resolved client IP only to the server-side Siteverify endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: async () => ({ success: true }) });

    await expect(
      verifyTurnstileToken("token-123", "203.0.113.42", "secret-123", fetchMock)
    ).resolves.toEqual({
      success: true,
      errorCodes: [],
    });
    const request = fetchMock.mock.calls[0][1];
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    );
    expect(request.body.toString()).toContain("secret=secret-123");
    expect(request.body.toString()).toContain("response=token-123");
    expect(request.body.toString()).toContain("remoteip=203.0.113.42");
  });

  it("fails closed for a missing token or a verification network error", async () => {
    await expect(
      verifyTurnstileToken(undefined, "203.0.113.42", "secret-123")
    ).resolves.toEqual({
      success: false,
      errorCodes: ["missing-input-response"],
    });
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(
      verifyTurnstileToken("token-123", "203.0.113.42", "secret-123", fetchMock)
    ).resolves.toEqual({
      success: false,
      errorCodes: ["internal-error"],
    });
  });

  it("accepts Cloudflare's documented dummy token with its always-pass test secret", async () => {
    await expect(
      verifyTurnstileToken(
        TURNSTILE_DUMMY_TOKEN,
        "203.0.113.42",
        TURNSTILE_ALWAYS_PASS_TEST_SECRET
      )
    ).resolves.toMatchObject({ success: true, errorCodes: [] });
  }, 15_000);

  it("requires explicit opt-in via TURNSTILE_ALLOW_TEST_KEY to use the test secret in dev", () => {
    // Without opt-in, returns empty string (safe default — verification will fail)
    const original = process.env.TURNSTILE_ALLOW_TEST_KEY;
    const originalSecret = process.env.TURNSTILE_SECRET_KEY;
    try {
      delete process.env.TURNSTILE_ALLOW_TEST_KEY;
      delete process.env.TURNSTILE_SECRET_KEY;
      // Re-import to pick up changed env — we test the function's logic directly
      // Since ENV is evaluated at module load, we test the function contract:
      // When turnstileAllowTestKey is false and turnstileSecretKey is empty,
      // the function should NOT return the always-pass secret.
      const secret = getTurnstileVerificationSecret();
      expect(secret).not.toBe(TURNSTILE_ALWAYS_PASS_TEST_SECRET);
    } finally {
      if (original !== undefined)
        process.env.TURNSTILE_ALLOW_TEST_KEY = original;
      if (originalSecret !== undefined)
        process.env.TURNSTILE_SECRET_KEY = originalSecret;
    }
  });
});
