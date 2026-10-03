/**
 * Key rotation: re-encrypts every PII envelope in `appointment_requests` with
 * the NEW primary key. Idempotent — rows already encrypted with the new
 * primary key are skipped, so re-running (e.g. after an interrupted run) is
 * safe and converges to zero updates.
 *
 * Key-ring model: PII_ENCRYPTION_KEYS is comma-separated; the FIRST entry is
 * the primary (encryption) key and the rest are retired keys kept for
 * decryption. To rotate: prepend the new key to the ring, restart the server,
 * run this script, then optionally drop the retired key from the ring.
 *
 * Refuses to run unless at least TWO keys are present (new primary + old
 * key), so a misconfigured single key can never silently "rotate" data into
 * an undecryptable state.
 *
 * Usage:
 *   PII_ENCRYPTION_KEYS=<new-key>,<old-key> npx tsx scripts/rotatePiiKey.ts
 */

import {
  decryptPii,
  encryptPii,
  isPiiEncryptionEnabled,
  tryDecryptWithPrimary,
  _resetKeyCache,
} from "../server/encryption";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const FIELDS = [
  "fullName",
  "contactNumber",
  "note",
  "nik",
  "tempatLahir",
  "tanggalLahir",
  "alamatLengkap",
  "email",
] as const;

function getRing(): string[] {
  return (process.env.PII_ENCRYPTION_KEYS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const ring = getRing();
  if (ring.length < 2) {
    console.error(
      "Refusing to run: PII_ENCRYPTION_KEYS must contain at least two keys " +
        "(new primary key first, old key(s) after) — both old and new keys are required.",
    );
    process.exit(1);
  }
  if (!isPiiEncryptionEnabled()) {
    console.error("PII encryption is not enabled — refusing to run.");
    process.exit(1);
  }
  _resetKeyCache();

  // Self-test: the primary key must round-trip before touching any rows.
  const probe = encryptPii("__rotation_probe__");
  if (!probe || decryptPii(probe) !== "__rotation_probe__") {
    console.error("Self-test failed: primary key does not round-trip — refusing to run.");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — refusing to run.");
    process.exit(1);
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL.split("?")[0]);
  const columns = FIELDS.map((f) => `\`${f}\``).join(", ");
  const [rows] = await conn.execute(`SELECT id, ${columns} FROM appointment_requests`);

  let rotated = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows as Record<string, unknown>[]) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const field of FIELDS) {
      const value = row[field];
      if (typeof value !== "string" || value.length === 0 || !value.startsWith("v1:")) continue;
      if (tryDecryptWithPrimary(value) !== null) {
        skipped += 1; // already encrypted with the new primary — idempotent skip
        continue;
      }
      let plaintext: string | null;
      try {
        plaintext = decryptPii(value); // tries every ring key in order
      } catch (err) {
        console.error(
          `row ${row.id} field ${field}: decrypt failed with every ring key — leaving untouched (${(err as Error).message})`,
        );
        failed += 1;
        continue;
      }
      if (plaintext === null) {
        failed += 1;
        continue;
      }
      sets.push(`\`${field}\` = ?`);
      vals.push(encryptPii(plaintext)); // re-encrypts with the new primary key
    }
    if (sets.length > 0) {
      await conn.execute(
        `UPDATE appointment_requests SET ${sets.join(", ")} WHERE id = ?`,
        [...vals, row.id],
      );
      rotated += 1;
      console.log(`rotated row ${row.id} (${sets.length} field(s))`);
    }
  }

  console.log(
    `done: ${rotated} row(s) rotated, ${skipped} field(s) already on the new primary, ${failed} field(s) failed`,
  );
  await conn.end();
  if (failed > 0) process.exit(2);
}

main().catch((error) => {
  console.error("rotation failed:", error);
  process.exit(1);
});
