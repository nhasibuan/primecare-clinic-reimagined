import { describe, expect, it, vi } from "vitest";
import { TURNSTILE_ALWAYS_PASS_TEST_SECRET, TURNSTILE_DUMMY_TOKEN, getTurnstileVerificationSecret, verifyTurnstileToken } from "./turnstile";


describe("Turnstile token verification", () => {
  it("submits a token and the resolved client IP only to the server-side Siteverify endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true }) });

    await expect(verifyTurnstileToken("token-123", "203.0.113.42", "secret-123", fetchMock)).resolves.toEqual({
      success: true,
      errorCodes: [],
    });
    const request = fetchMock.mock.calls[0][1];
    expect(fetchMock.mock.calls[0][0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(request.body.toString()).toContain("secret=secret-123");
    expect(request.body.toString()).toContain("response=token-123");
    expect(request.body.toString()).toContain("remoteip=203.0.113.42");
  });

  it("fails closed for a missing token or a verification network error", async () => {
    await expect(verifyTurnstileToken(undefined, "203.0.113.42", "secret-123")).resolves.toEqual({
      success: false,
      errorCodes: ["missing-input-response"],
    });
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(verifyTurnstileToken("token-123", "203.0.113.42", "secret-123", fetchMock)).resolves.toEqual({
      success: false,
      errorCodes: ["internal-error"],
    });
  });

  it("accepts Cloudflare's documented dummy token with its always-pass test secret", async () => {
    await expect(
      verifyTurnstileToken(TURNSTILE_DUMMY_TOKEN, "203.0.113.42", TURNSTILE_ALWAYS_PASS_TEST_SECRET),
    ).resolves.toMatchObject({ success: true, errorCodes: [] });
  }, 15_000);

  it("uses the official test secret outside production so local CAPTCHA fallback QA remains deterministic", () => {
    expect(getTurnstileVerificationSecret()).toBe(TURNSTILE_ALWAYS_PASS_TEST_SECRET);
  });
});
