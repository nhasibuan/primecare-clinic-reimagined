import { ENV } from "./_core/env";

const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_ALWAYS_PASS_TEST_SECRET = "1x0000000000000000000000000000000AA";
export const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

type TurnstileResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export type TurnstileSecretCheck = {
  valid: boolean;
  errorCodes: string[];
};

export type TurnstileVerification = {
  success: boolean;
  errorCodes: string[];
};

/**
 * Returns the Turnstile secret to use for verification.
 * In production, always uses the real secret key.
 * In dev/staging, uses the real secret if configured, otherwise falls back to
 * the always-pass test key ONLY if explicitly opted in via TURNSTILE_ALLOW_TEST_KEY=true.
 */
export function getTurnstileVerificationSecret() {
  if (ENV.isProduction) return ENV.turnstileSecretKey;
  // Non-production: prefer a real key if available
  if (ENV.turnstileSecretKey) return ENV.turnstileSecretKey;
  // Only allow the always-pass test secret when explicitly opted in
  if (ENV.turnstileAllowTestKey) return TURNSTILE_ALWAYS_PASS_TEST_SECRET;
  return ENV.turnstileSecretKey; // empty string → verification will fail (safe default)
}

export async function verifyTurnstileToken(
  token: string | undefined,
  clientIp: string,
  secretKey = ENV.turnstileSecretKey,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileVerification> {
  if (!secretKey) return { success: false, errorCodes: ["missing-input-secret"] };
  if (!token?.trim() || token.length > 2048) return { success: false, errorCodes: ["missing-input-response"] };

  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (clientIp && clientIp !== "unknown") body.set("remoteip", clientIp);

  try {
    const response = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const result = await response.json() as TurnstileResponse;
    return { success: Boolean(result.success), errorCodes: result["error-codes"] ?? [] };
  } catch {
    return { success: false, errorCodes: ["internal-error"] };
  }
}

/**
 * Sends no visitor token. A valid secret therefore returns a token-related
 * validation error, while an invalid secret returns invalid-input-secret.
 */
export async function checkTurnstileSecret(
  secretKey = ENV.turnstileSecretKey,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileSecretCheck> {
  if (!secretKey) return { valid: false, errorCodes: ["missing-input-secret"] };

  const body = new URLSearchParams({ secret: secretKey });
  const response = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = await response.json() as TurnstileResponse;
  const errorCodes = result["error-codes"] ?? [];
  const valid = !errorCodes.includes("missing-input-secret") && !errorCodes.includes("invalid-input-secret");
  return { valid, errorCodes };
}
