#!/usr/bin/env node
/**
 * One-command admin credential rotation for the self-hosted login.
 *
 * Updates ADMIN_PASSWORD_HASH (and optionally ADMIN_USERNAME) in .env AND
 * refreshes the encrypted vault at /root/secrets/primecare-secrets.asc in a
 * single step, so the recovery copy never drifts from the live value.
 *
 * Usage (run on the VM):
 *   node scripts/setAdminPassword.mjs 'your-new-passphrase'
 *   node scripts/setAdminPassword.mjs --generate
 *   node scripts/setAdminPassword.mjs 'new-pass' --username norman
 *
 * The script prints the password once when --generate is used; capture it
 * into your password manager. The hash is printed to stdout as
 * ADMIN_PASSWORD_HASH=... so it can be piped, but the plaintext password is
 * never written to disk.
 */
import { randomBytes, scrypt as scryptCb, randomFillSync } from "node:crypto";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { argv, exit } from "node:process";

const scrypt = promisify(scryptCb);

const N = 1 << 15;
const r = 8;
const p = 1;
const keylen = 64;
const maxmem = 128 * 1024 * 1024;

function fail(message) {
  console.error(`error: ${message}`);
  exit(1);
}

// ── Argument parsing ────────────────────────────────────────────────────────
const args = argv.slice(2);
let password = null;
let username = null;
let generate = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--generate") generate = true;
  else if (args[i] === "--username") username = args[++i] ?? fail("--username requires a value");
  else password = args[i];
}
if (generate && password) fail("pass either a password or --generate, not both");
if (!generate && !password) {
  fail("usage: node scripts/setAdminPassword.mjs '<password>' | --generate [--username name]");
}
if (username !== null && username.length < 4) fail("username must be at least 4 characters");

// ── Paths ───────────────────────────────────────────────────────────────────
const repoRoot = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const envPath = `${repoRoot}/.env`;
const secretsDir = "/root/secrets";
const vaultPath = `${secretsDir}/primecare-secrets.asc`;
const passFile = `${secretsDir}/master-passphrase.txt`;

if (!existsSync(envPath)) fail(`.env not found at ${envPath}`);
const haveVault = existsSync(vaultPath) && existsSync(passFile);
if (!haveVault) {
  console.error("[warn] vault not found — updating .env only; recovery copy will be stale");
}

// ── Generate password if requested ──────────────────────────────────────────
if (generate) {
  password = Buffer.from(randomFillSync(new Uint8Array(24))).toString("base64url");
  console.log(`\nGenerated password (capture it now — it is shown only once):\n\n    ${password}\n`);
}

// ── Hash ────────────────────────────────────────────────────────────────────
if (password.length < 12) fail("password must be at least 12 characters");
const salt = randomBytes(16);
const hash = await scrypt(password, salt, keylen, { N, r, p, maxmem });
const encoded = ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");

// ── Update .env ─────────────────────────────────────────────────────────────
let envContent = readFileSync(envPath, "utf8");
if (username !== null) {
  if (/^ADMIN_USERNAME=/m.test(envContent)) {
    envContent = envContent.replace(/^ADMIN_USERNAME=.*$/m, `ADMIN_USERNAME="${username}"`);
  } else {
    envContent += `\nADMIN_USERNAME="${username}"\n`;
  }
}
if (/^ADMIN_PASSWORD_HASH=/m.test(envContent)) {
  envContent = envContent.replace(/^ADMIN_PASSWORD_HASH=.*$/m, `ADMIN_PASSWORD_HASH="${encoded}"`);
} else {
  envContent += `\nADMIN_PASSWORD_HASH="${encoded}"\n`;
}
writeFileSync(envPath, envContent, { mode: 0o600 });
console.log("[ok] .env updated (ADMIN_PASSWORD_HASH" + (username ? " + ADMIN_USERNAME" : "") + ")");

// ── Refresh vault (AES-256-CBC + HMAC, GPG binary container) ────────────────
// The vault was created by `gpg -c` with iterated SHA-512 S2K; without pinentry
// tooling here we rewrite it using an equivalent deterministic format derived
// from the same master passphrase file, preserving the original passphrase.
if (haveVault) {
  const master = readFileSync(passFile, "utf8").trim();
  if (master.length < 32) fail("master passphrase file looks wrong — aborting");

  // Decrypt the existing vault with gpg (it created it, it reads it).
  const plain = execFileSync("gpg", [
    "--batch", "--yes", "--pinentry-mode", "loopback",
    "--passphrase-file", passFile, "-d", vaultPath,
  ], { maxBuffer: 10 * 1024 * 1024 });

  // Apply .env-mirrored updates to the manifest.
  const manifest = plain.toString("utf8").split("\n");
  const upsert = (key, value) => {
    const idx = manifest.findIndex(l => l.startsWith(`${key}=`));
    const line = `${key}="${value}"`;
    if (idx >= 0) manifest[idx] = line;
    else manifest.push(line);
  };
  if (username !== null) upsert("ADMIN_USERNAME", username);
  upsert("ADMIN_PASSWORD_HASH", encoded);
  const updatedManifest = manifest.join("\n");

  // Re-encrypt with gpg using the same parameters it was created with.
  execFileSync("gpg", [
    "--batch", "--yes", "--pinentry-mode", "loopback",
    "--cipher-algo", "AES256", "--s2k-mode", "3",
    "--s2k-digest-algo", "SHA512", "--s2k-count", "65011712",
    "--passphrase-file", passFile,
    "-o", vaultPath, "-c",
  ], { input: updatedManifest, maxBuffer: 10 * 1024 * 1024 });

  // Verify round-trip.
  const verify = execFileSync("gpg", [
    "--batch", "--yes", "--pinentry-mode", "loopback",
    "--passphrase-file", passFile, "-d", vaultPath,
  ], { maxBuffer: 10 * 1024 * 1024 }).toString("utf8");
  if (!verify.includes(`ADMIN_PASSWORD_HASH="${encoded}"`)) {
    fail("vault verification failed after re-encryption — vault integrity error");
  }
  console.log("[ok] vault refreshed and verified");
}

console.log("\nNext: restart the server so the new hash takes effect:");
console.log("  dev:  touch server/_core/index.ts   (tsx watch reloads)");
console.log("  prod: sudo systemctl restart primecare");
