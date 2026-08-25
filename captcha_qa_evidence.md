# CAPTCHA Fallback QA Evidence

The development-only `captchaQaE2E=1` route drove the public appointment dialog through three successful submissions and a fourth submission from the same browser session. The fourth request invoked the ordinary `TOO_MANY_REQUESTS` mutation handler, showed the **Verifikasi keamanan diperlukan** panel, and displayed the recovery toast. The flow did not use the `captchaFallback=1` force flag.

The inspected desktop capture shows the visible fallback panel and recovery toast. The inspected 375px mobile capture shows the same fallback panel, explanatory privacy copy, responsive test Turnstile widget, alternative WhatsApp link, and recovery toast. The test-key/scroll query helpers are gated by `import.meta.env.DEV`; production neither activates them nor uses the official test secret.

The real development endpoint was also exercised with Cloudflare's documented always-pass test credentials: it returned HTTP 429 without a token after three submissions, then accepted the official dummy token and created the fourth request. Honeypot handling was confirmed independently and remained non-persistent. All QA rows named `QA CAPTCHA Solved` and `QA CAPTCHA Browser Fallback` were deleted; database confirmation returned zero remaining rows for each marker.
