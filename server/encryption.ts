/**
 * AES-256-GCM field-level encryption for patient PII.
 *
 * Implements Indonesian UU PDP No. 27/2022 compliance hardening by encrypting
 * sensitive fields (NIK, phone numbers, addresses) at the application layer
 * before they reach MySQL — protecting data even if the database is exfiltrated.
 *
 * Architecture:
 *   - Key: 256-bit derived from the PII key ring via HKDF-SHA256
 *   - Cipher: AES-256-GCM (authenticated encryption — prevents tampering)
 *   - Format: "v1:<base64-iv>:<base64-ciphertext+tag>"
 *   - Envelope versioning allows future key rotation
 *
 * Key ring (rotation support):
 *   - `PII_ENCRYPTION_KEYS`: comma-separated key ring; the FIRST entry is the
 *     primary key used for encryption, the rest are retired keys kept so old
 *     ciphertext still decrypts. Takes precedence when set and non-empty.
 *   - `PII_ENCRYPTION_KEY`: legacy single-key form, used when the ring var is
 *     absent. Equivalent to a one-entry ring.
 *   - `encryptPii*` always uses the primary (first) key.
 *   - `decryptPii*` tries each ring key in order until one authenticates.
 *   - Rotate with: prepend the new key to the ring, restart, run
 *     `scripts/rotatePiiKey.ts` to re-encrypt every envelope with the new
 *     primary, then optionally drop the retired key from the ring.
 *
 * Usage:
 *   When a key is configured, encrypt/decrypt transparently.
 *   When absent (dev/test), functions are no-ops (pass-through).
 *
 * ⚠️  Store PII_ENCRYPTION_KEY(S) in a secrets manager (Vault, AWS Secrets Manager)
 *     — never in source control or plain environment files.
 */

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "crypto";

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const TAG_BYTES = 16; // 128-bit authentication tag (GCM default)
const VERSION_PREFIX = "v1:" as const;

/** Derived 256-bit AES keys (one per ring entry), memoized per process. */
let _cachedKeys: Buffer[] | null = null;

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

/**
 * Raw key-ring secrets: PII_ENCRYPTION_KEYS (comma-separated, first = primary)
 * with fallback to the legacy single PII_ENCRYPTION_KEY.
 */
function getKeySecrets(): string[] {
  const ring = process.env.PII_ENCRYPTION_KEYS;
  if (ring) {
    const keys = ring
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (keys.length > 0) return keys;
  }
  const single = process.env.PII_ENCRYPTION_KEY;
  return single ? [single] : [];
}

/** Derived ring keys, memoized. First entry is the primary (encryption) key. */
function getKeyRing(): Buffer[] {
  if (!_cachedKeys) {
    _cachedKeys = getKeySecrets().map(deriveKey);
  }
  return _cachedKeys;
}

/** Primary key used for encryption, or null when unconfigured. */
function getPrimaryKey(): Buffer | null {
  const ring = getKeyRing();
  return ring.length > 0 ? ring[0] : null;
}

/** Returns true when field-level encryption is active (either var set). */
export function isPiiEncryptionEnabled(): boolean {
  return getKeySecrets().length > 0;
}

interface ParsedEnvelope {
  iv: Buffer;
  ciphertext: Buffer;
  tag: Buffer;
}

/** Parses a v1: envelope. Returns null when the value is not an envelope. */
function parseEnvelope(value: string): ParsedEnvelope | null {
  if (!value.startsWith(VERSION_PREFIX)) return null;
  const rest = value.slice(VERSION_PREFIX.length);
  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) return null;

  const iv = Buffer.from(rest.slice(0, colonIdx), "base64");
  const payload = Buffer.from(rest.slice(colonIdx + 1), "base64");
  if (payload.length < TAG_BYTES) return null;

  // Last TAG_BYTES are the GCM authentication tag
  return {
    iv,
    ciphertext: payload.slice(0, payload.length - TAG_BYTES),
    tag: payload.slice(payload.length - TAG_BYTES),
  };
}

function decryptWithKey(envelope: ParsedEnvelope, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, envelope.iv);
  decipher.setAuthTag(envelope.tag);
  return decipher.update(envelope.ciphertext) + decipher.final("utf8");
}

/**
 * Encrypts a plaintext string. Returns the ciphertext envelope.
 * Uses the primary (first) ring key.
 * Pass-through (returns `value` unchanged) when no key is configured.
 */
export function encryptPii(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const key = getPrimaryKey();
  if (!key) return value; // encryption not configured — pass-through

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Envelope: "v1:<iv_b64>:<ciphertext+tag_b64>"
  const payload = Buffer.concat([encrypted, tag]);
  return `${VERSION_PREFIX}${iv.toString("base64")}:${payload.toString("base64")}`;
}

/**
 * Decrypts a ciphertext envelope. Returns the original plaintext.
 * Tries each ring key in order until one authenticates, so data encrypted
 * with a retired key still decrypts while the old key remains in the ring.
 * Pass-through when the value is not in envelope format or no key is set.
 */
export function decryptPii(value: string | null | undefined): string | null {
  if (!value) return value ?? null;

  // Not an encrypted envelope — treat as plaintext (backwards-compatible)
  const envelope = parseEnvelope(value);
  if (!envelope) return value;

  const ring = getKeyRing();
  if (ring.length === 0) {
    // Key removed after data was encrypted — return raw envelope to avoid data loss
    return value;
  }

  for (const key of ring) {
    try {
      return decryptWithKey(envelope, key);
    } catch {
      // Wrong key (or tampered data) — try the next key in the ring.
    }
  }
  // Authentication failure — data may be tampered; do not return garbage
  throw new Error("PII decryption failed: authentication tag mismatch.");
}

/**
 * Decrypts using ONLY the primary (first) ring key.
 * Returns null when the value was encrypted with a different (retired) ring
 * key — used by scripts/rotatePiiKey.ts to skip rows already rotated.
 * Pass-through semantics match decryptPii for non-envelope / unconfigured cases.
 */
export function tryDecryptWithPrimary(
  value: string | null | undefined
): string | null {
  if (!value) return value ?? null;

  const envelope = parseEnvelope(value);
  if (!envelope) return value;

  const primary = getPrimaryKey();
  if (!primary) return value;

  try {
    return decryptWithKey(envelope, primary);
  } catch {
    return null;
  }
}

/**
 * Encrypts a record of PII fields in-place.
 * Fields with null/undefined values are left unchanged.
 *
 * @example
 * const safe = encryptPiiFields({ nik: "3201234567890001", phone: "081234567890" });
 */
export function encryptPiiFields<
  T extends Record<string, string | null | undefined>,
>(fields: T): T {
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
export function decryptPiiFields<
  T extends Record<string, string | null | undefined>,
>(fields: T): T {
  const result = { ...fields };
  for (const key of Object.keys(result) as (keyof T)[]) {
    (result[key] as string | null) = decryptPii(result[key] as string | null);
  }
  return result;
}

// Reset cached keys (useful in tests when env vars change between test cases)
export function _resetKeyCache(): void {
  _cachedKeys = null;
}
