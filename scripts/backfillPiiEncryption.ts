/**
 * One-time backfill: encrypts legacy plaintext PII rows written before
 * PII_ENCRYPTION_KEY was provisioned. Idempotent — values already in
 * `v1:` envelope format are skipped, so it is safe to re-run.
 *
 * Usage:
 *   PII_ENCRYPTION_KEY=<key> npx tsx scripts/backfillPiiEncryption.ts
 */

import { encryptPii, isPiiEncryptionEnabled } from "../server/encryption";
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

async function main() {
  if (!isPiiEncryptionEnabled()) {
    console.error("PII_ENCRYPTION_KEY is not set — refusing to run.");
    process.exit(1);
  }

  const conn = await mysql.createConnection(
    process.env.DATABASE_URL!.split("?")[0]
  );
  const columns = FIELDS.map(f => `\`${f}\``).join(", ");
  const [rows] = await conn.execute(
    `SELECT id, ${columns} FROM appointment_requests`
  );
  let updated = 0;

  for (const row of rows as Record<string, unknown>[]) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const field of FIELDS) {
      const value = row[field];
      if (
        typeof value === "string" &&
        value.length > 0 &&
        !value.startsWith("v1:")
      ) {
        sets.push(`\`${field}\` = ?`);
        vals.push(encryptPii(value));
      }
    }
    if (sets.length > 0) {
      await conn.execute(
        `UPDATE appointment_requests SET ${sets.join(", ")} WHERE id = ?`,
        [...vals, row.id]
      );
      updated += 1;
      console.log(`encrypted row ${row.id} (${sets.length} field(s))`);
    }
  }

  console.log(`done: ${updated} row(s) backfilled`);
  await conn.end();
}

main().catch(error => {
  console.error("backfill failed:", error);
  process.exit(1);
});
