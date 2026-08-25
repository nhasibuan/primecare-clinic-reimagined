import { describe, expect, it } from "vitest";
import { checkTurnstileSecret } from "./turnstile";

describe("Cloudflare Turnstile credential", () => {
  it("accepts the configured server secret without submitting a visitor token", async () => {
    const result = await checkTurnstileSecret();
    expect(result.valid).toBe(true);
    expect(result.errorCodes).not.toContain("invalid-input-secret");
  }, 15_000);
});
