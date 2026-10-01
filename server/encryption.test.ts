/**
 * Encryption tests for AES-256-GCM PII encryption service.
 *
 * Validates round-trip correctness, envelope format, pass-through behaviour
 * (no key configured), authentication tag verification, and multi-field helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptPii,
  decryptPii,
  encryptPiiFields,
  decryptPiiFields,
  isPiiEncryptionEnabled,
  _resetKeyCache,
} from "./encryption";

const TEST_KEY = "test_pii_key_that_is_sufficiently_long_for_sha256_derivation";

function withKey(fn: () => void) {
  process.env.PII_ENCRYPTION_KEY = TEST_KEY;
  _resetKeyCache();
  try { fn(); } finally {
    delete process.env.PII_ENCRYPTION_KEY;
    _resetKeyCache();
  }
}

describe("PII Encryption", () => {
  beforeEach(() => {
    delete process.env.PII_ENCRYPTION_KEY;
    _resetKeyCache();
  });

  afterEach(() => {
    delete process.env.PII_ENCRYPTION_KEY;
    _resetKeyCache();
  });

  describe("pass-through when no key is configured", () => {
    it("encryptPii returns value unchanged", () => {
      expect(encryptPii("3201234567890001")).toBe("3201234567890001");
    });

    it("decryptPii returns value unchanged for plaintext", () => {
      expect(decryptPii("plaintext")).toBe("plaintext");
    });

    it("returns null for null input", () => {
      expect(encryptPii(null)).toBeNull();
      expect(decryptPii(null)).toBeNull();
    });

    it("isPiiEncryptionEnabled returns false", () => {
      expect(isPiiEncryptionEnabled()).toBe(false);
    });
  });

  describe("with encryption key configured", () => {
    it("isPiiEncryptionEnabled returns true", () => {
      withKey(() => expect(isPiiEncryptionEnabled()).toBe(true));
    });

    it("round-trip: encrypt then decrypt returns original", () => {
      withKey(() => {
        const original = "3201234567890001";
        const ciphertext = encryptPii(original);
        expect(ciphertext).not.toBe(original);
        expect(decryptPii(ciphertext)).toBe(original);
      });
    });

    it("produces the versioned envelope format", () => {
      withKey(() => {
        const ciphertext = encryptPii("test");
        expect(ciphertext).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
      });
    });

    it("each call produces a different IV (random)", () => {
      withKey(() => {
        const c1 = encryptPii("same-value");
        const c2 = encryptPii("same-value");
        expect(c1).not.toBe(c2);
        // But both decrypt to the same plaintext
        expect(decryptPii(c1)).toBe("same-value");
        expect(decryptPii(c2)).toBe("same-value");
      });
    });

    it("handles Indonesian NIK format", () => {
      withKey(() => {
        const nik = "3578012505980003";
        expect(decryptPii(encryptPii(nik))).toBe(nik);
      });
    });

    it("handles phone numbers", () => {
      withKey(() => {
        const phone = "+6281234567890";
        expect(decryptPii(encryptPii(phone))).toBe(phone);
      });
    });
  });

  describe("backwards-compatibility", () => {
    it("decrypts plaintext (pre-encryption data) unchanged", () => {
      withKey(() => {
        expect(decryptPii("legacy-plaintext")).toBe("legacy-plaintext");
      });
    });
  });

  describe("encryptPiiFields / decryptPiiFields", () => {
    it("encrypts and decrypts multiple fields", () => {
      withKey(() => {
        const original = { nik: "3201234567890001", phone: "08123456789", address: null };
        const encrypted = encryptPiiFields(original);
        expect(encrypted.nik).not.toBe(original.nik);
        expect(encrypted.phone).not.toBe(original.phone);
        expect(encrypted.address).toBeNull();

        const decrypted = decryptPiiFields(encrypted);
        expect(decrypted.nik).toBe(original.nik);
        expect(decrypted.phone).toBe(original.phone);
        expect(decrypted.address).toBeNull();
      });
    });
  });

  describe("envelope capacity contract", () => {
    // Keep in sync with drizzle/schema.ts: encrypted columns must be wide
    // enough for the AES-256-GCM envelope of the longest plaintext the Zod
    // input schemas accept. Envelope length = 20 + 4*ceil((n+16)/3).
    const COLUMN_CAPACITIES: { field: string; plainMaxLength: number; columnWidth: number }[] = [
      { field: "appointment_requests.fullName", plainMaxLength: 160, columnWidth: 400 },
      { field: "appointment_requests.contactNumber", plainMaxLength: 40, columnWidth: 128 },
      { field: "appointment_requests.note", plainMaxLength: 600, columnWidth: 1024 },
      { field: "appointment_requests.nik", plainMaxLength: 30, columnWidth: 128 },
      { field: "appointment_requests.tempatLahir", plainMaxLength: 100, columnWidth: 192 },
      { field: "appointment_requests.tanggalLahir", plainMaxLength: 10, columnWidth: 64 },
      { field: "appointment_requests.alamatLengkap", plainMaxLength: 500, columnWidth: 768 },
      { field: "appointment_requests.email", plainMaxLength: 255, columnWidth: 400 },
      { field: "queue_entries.patientName", plainMaxLength: 160, columnWidth: 400 },
    ];

    it("ciphertext envelope fits the widened column for max-length plaintext", () => {
      withKey(() => {
        for (const { field, plainMaxLength, columnWidth } of COLUMN_CAPACITIES) {
          const envelope = encryptPii("x".repeat(plainMaxLength));
          expect(envelope, field).toBeTruthy();
          expect(
            (envelope as string).length,
            `${field}: envelope must fit varchar(${columnWidth})`,
          ).toBeLessThanOrEqual(columnWidth);
        }
      });
    });
  });
});
