export const COOKIE_NAME = "app_session_id";
/**
 * Production cookie name with the `__Host-` prefix (see server/_core/cookies.ts).
 * The prefix is enforced only in production because it requires HTTPS; dev
 * keeps the plain name so local HTTP logins keep working.
 */
export const PROD_COOKIE_NAME = "__Host-app_session_id";
/**
 * Session lifetime: 30 days. Session JWTs (sdk.signSession default) and the
 * session cookie maxAge all use this constant. Reduced from 1 year on
 * 2026-10-03 (README threat-review remediation).
 */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
export const DB_UNAVAILABLE_ERR_MSG = 'Database is temporarily unavailable. Please try again later. (10003)';

// One-time nonce cookie that binds an OAuth login to the browser that started
// it. The `__Host-` prefix forces the cookie host-only (Secure, Path=/, no
// Domain), so a sibling *.manus.space site cannot plant a matching value in a
// victim's browser.
export const OAUTH_STATE_COOKIE = "__Host-oauth_state";

// `state` carries the callback redirect URI (used at token exchange) plus the
// CSRF nonce. Defined here so the client encoder and server decoder never drift.
export type OAuthState = { redirectUri: string; nonce?: string };

export const encodeOAuthState = (state: OAuthState): string =>
  btoa(JSON.stringify(state));

export const decodeOAuthState = (state: string): OAuthState => {
  let decoded: string;
  try {
    decoded = atob(state);
  } catch {
    // Malformed base64 (e.g. attacker-supplied garbage). Return no nonce so the
    // callback's CSRF guard rejects it with 403 — never throw, since the caller
    // runs outside the request handler's try/catch.
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
    // Legacy links: `state` was a bare base64(redirectUri) with no nonce.
  }
  return { redirectUri: decoded };
};

/**
 * Recognized Indonesian religion values (UU PDP / KTP standard).
 * Single source of truth — imported by schemas/index.ts (server validation)
 * and client form components to prevent drift between validation and UI.
 */export const AGAMA_VALUES = [
  "Islam",
  "Kristen",
  "Katolik",
  "Hindu",
  "Buddha",
  "Khonghucu",
  "Tidak ada",
] as const;

export type Agama = (typeof AGAMA_VALUES)[number];

/**
 * Minimum number of admin accounts recommended to avoid single-point lockout.
 * When admin count drops to or below this threshold, a warning should be shown.
 */
export const MIN_ADMIN_COUNT_SAFE = 2;
