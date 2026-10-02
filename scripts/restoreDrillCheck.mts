/**
 * Restore-drill verification: proves a restored database decrypts correctly.
 *
 * Run by deploy/primecare-restore-drill.sh against a scratch copy of the
 * latest encrypted backup. All inputs are env-injected by the drill script
 * (in memory only — this file never reads .env or the secrets vault):
 *   DRILL_DATABASE_URL  mysql://… URL pointing at the scratch DB
 *   PII_ENCRYPTION_KEY  the live key, passed through the environment
 *
 * Exits 0 when sampled appointment_requests rows decrypt cleanly,
 * 1 on connection errors, GCM auth-tag failures, or empty plaintext.
 * Never prints decrypted values — only counts.
 */

import mysql from "mysql2/promise";
import { decryptPii } from "../server/encryption";

const SAMPLE_ROWS = 25;
const PII_FIELDS = ["fullName", "contactNumber", "nik", "email"] as const;

async function main(): Promise<void> {
  const url = process.env.DRILL_DATABASE_URL;
  if (!url) throw new Error("DRILL_DATABASE_URL is not set");
  if (!process.env.PII_ENCRYPTION_KEY) throw new Error("PII_ENCRYPTION_KEY is not set");

  const conn = await mysql.createConnection(url.split("?")[0]);
  try {
    const columns = PII_FIELDS.map((f) => `\`${f}\``).join(", ");
    const [rows] = await conn.execute(
      `SELECT id, ${columns} FROM appointment_requests ORDER BY id DESC LIMIT ${SAMPLE_ROWS}`,
    );
    const records = rows as Record<string, string | null>[];

    if (records.length === 0) {
      console.log("decrypt-check ok: appointment_requests has no rows — nothing to decrypt");
      return;
    }

    let envelopes = 0;
    let decrypted = 0;
    for (const row of records) {
      for (const field of PII_FIELDS) {
        const value = row[field];
        if (typeof value !== "string" || !value.startsWith("v1:")) continue;
        envelopes += 1;
        // Throws on GCM auth-tag mismatch (tampered/wrong-key ciphertext).
        const plain = decryptPii(value);
        if (plain === null || plain.length === 0) {
          throw new Error(`row ${String(row.id)}: ${field} decrypted to empty plaintext`);
        }
        decrypted += 1;
      }
    }

    if (envelopes === 0) {
      console.log(
        `decrypt-check WARN: ${records.length} row(s) sampled, none carry v1: envelopes ` +
          "(plaintext PII — run scripts/backfillPiiEncryption.ts against production)",
      );
      return;
    }
    console.log(
      `decrypt-check ok: ${envelopes} v1 envelope(s) across ${records.length} row(s), ` +
        `${decrypted} decrypted cleanly`,
    );
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error("decrypt-check FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
