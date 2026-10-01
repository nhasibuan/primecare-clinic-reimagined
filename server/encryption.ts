/**
 * AES-256-GCM field-level encryption for patient PII.
 *
 * Implements Indonesian UU PDP No. 27/2022 compliance hardening by encrypting
 * sensitive fields (NIK, phone numbers, addresses) at the application layer
 * before they reach MySQL — protecting data even if the database is exfiltrated.
 *
 * Architecture:
 *   - Key: 256-bit derived from PII_ENCRYPTION_KEY env var via HKDF-SHA256
 *   - Cipher: AES-256-GCM (authenticated encryption — prevents tampering)
 *   - Format: "v1:<base64-iv>:<base64-ciphertext+tag>"
 *   - Envelope versioning allows future key rotation
 *
 * Usage:
 *   When PII_ENCRYPTION_KEY is set, encrypt/decrypt transparently.
 *   When absent (dev/test), functions are no-ops (pass-through).
 *
 * ⚠️  Store PII_ENCRYPTION_KEY in a secrets manager (Vault, AWS Secrets Manager)
 *     — never in source control or plain environment files.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12;      // 96-bit IV recommended for GCM
const TAG_BYTES = 16;     // 128-bit authentication tag (GCM default)
const VERSION_PREFIX = "v1:" as const;

/** Derived 256-bit AES key, memoized per process. */
let _cachedKey: Buffer | null = null;

function deriveKey(secret: string): Buffer {
  // HKDF-SHA256 with a fixed, versioned salt. A plain SHA-256(secret) would
  // also be deterministic, but HKDF separates the salt from the input keying
  // material and derives keys with uniform entropy — so the same secret can
  // later be reused for other purposes with a different `info` label without
  // producing the same key. Bump SALT/INFO together with the envelope version
  // if the derivation ever changes.
  const salt = "primecare-pii-encryption-v1";
  const info = "pii-field-encryption";
  return Buffer.from(hkdfSync("sha256", secret, salt, info, 32));
}

function getKey(): Buffer | null {
  const secret = process.env.PII_ENCRYPTION_KEY;
  if (!secret) return null;
  if (!_cachedKey) {
    _cachedKey = deriveKey(secret);
  }
  return _cachedKey;
}

/** Returns true when field-level encryption is active. */
export function isPiiEncryptionEnabled(): boolean {
  return Boolean(process.env.PII_ENCRYPTION_KEY);
}

/**
 * Encrypts a plaintext string. Returns the ciphertext envelope.
 * Pass-through (returns `value` unchanged) when no key is configured.
 */
export function encryptPii(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const key = getKey();
  if (!key) return value;                // encryption not configured — pass-through

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Envelope: "v1:<iv_b64>:<ciphertext+tag_b64>"
  const payload = Buffer.concat([encrypted, tag]);
  return `${VERSION_PREFIX}${iv.toString("base64")}:${payload.toString("base64")}`;
}

/**
 * Decrypts a ciphertext envelope. Returns the original plaintext.
 * Pass-through when the value is not in envelope format or no key is set.
 */
export function decryptPii(value: string | null | undefined): string | null {
  if (!value) return value ?? null;

  // Not an encrypted envelope — treat as plaintext (backwards-compatible)
  if (!value.startsWith(VERSION_PREFIX)) return value;

  const key = getKey();
  if (!key) {
    // Key removed after data was encrypted — return raw envelope to avoid data loss
    return value;
  }

  const rest = value.slice(VERSION_PREFIX.length);
  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) return value;

  const iv = Buffer.from(rest.slice(0, colonIdx), "base64");
  const payload = Buffer.from(rest.slice(colonIdx + 1), "base64");

  // Last TAG_BYTES are the GCM authentication tag
  const ciphertext = payload.slice(0, payload.length - TAG_BYTES);
  const tag = payload.slice(payload.length - TAG_BYTES);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch {
    // Authentication failure — data may be tampered; do not return garbage
    throw new Error("PII decryption failed: authentication tag mismatch.");
  }
}

/**
 * Encrypts a record of PII fields in-place.
 * Fields with null/undefined values are left unchanged.
 *
 * @example
 * const safe = encryptPiiFields({ nik: "3201234567890001", phone: "081234567890" });
 */
export function encryptPiiFields<T extends Record<string, string | null | undefined>>(
  fields: T,
): T {
  const result = { ...fields };
  for (const key of Object.keys(result) as (keyof T)[]) {
    (result[key] as string | null) = encryptPii(result[key] as string | null);
  }
  return result;
}

/**
 * Decrypts a record of PII fields in-place.
 *
 * @example
 * const readable = decryptPiiFields({ nik: "v1:abc123:xyz789", phone: "v1:..." });
 */
export function decryptPiiFields<T extends Record<string, string | null | undefined>>(
  fields: T,
): T {
  const result = { ...fields };
  for (const key of Object.keys(result) as (keyof T)[]) {
    (result[key] as string | null) = decryptPii(result[key] as string | null);
  }
  return result;
}

// Reset cached key (useful in tests when env var changes between test cases)
export function _resetKeyCache(): void {
  _cachedKey = null;
}
