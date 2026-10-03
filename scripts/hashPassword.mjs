#!/usr/bin/env node
/**
 * Generate a scrypt hash for ADMIN_PASSWORD_HASH (self-hosted admin login).
 *
 * Usage:
 *   node scripts/hashPassword.mjs <password>
 *   node scripts/hashPassword.mjs            # generates a strong password
 *
 * The hash is self-describing (scrypt$N$r$p$salt$hash) so parameter upgrades
 * never invalidate stored hashes. Put the printed value in ADMIN_PASSWORD_HASH.
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const N = 1 << 15;
const r = 8;
const p = 1;
const keylen = 64;
const maxmem = 128 * 1024 * 1024;

const password = process.argv[2] || randomBytes(24).toString("base64url"); // ~192-bit entropy, URL-safe

if (typeof password !== "string" || password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await scrypt(password, salt, keylen, { N, r, p, maxmem });
const encoded = [
  "scrypt",
  N,
  r,
  p,
  salt.toString("base64"),
  hash.toString("base64"),
].join("$");

console.log(`password: ${password}`);
console.log(`ADMIN_PASSWORD_HASH=${encoded}`);
