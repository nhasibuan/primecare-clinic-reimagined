#!/usr/bin/env node
/**
 * README drift guard — exits non-zero with a clear message when README.md
 * claims no longer match the codebase.
 *
 * Checks (kept robust, not brittle — each claim is located by its table-row
 * marker and compared against the authoritative source):
 *   (a) dependency versions named in the "Dependency Versions" row match
 *       package.json (TypeScript, Vite, Vitest, Drizzle)
 *   (b) the "Database Schema" table count matches drizzle/schema.ts
 *   (c) the "Unit & Integration Tests" file count matches the vitest include set
 *
 * Usage: node scripts/verifyReadme.mjs   (or: pnpm docs:verify)
 * Also runs in CI (.github/workflows/dependencies.yml, verify job).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const passes = [];

function findRow(readme, marker) {
  return readme.split("\n").find(line => line.includes(marker));
}

function check(name, fn) {
  try {
    const detail = fn();
    passes.push(`${name}: ${detail}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
  }
}

// (a) dependency versions: README claim vs package.json spec
check("dependency versions", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const row = findRow(readme, "**Dependency Versions**");
  if (!row)
    throw new Error(
      'README has no "**Dependency Versions**" table row to verify against'
    );
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const claims = {
    typescript: /TypeScript\s+(\d+\.\d+\.\d+)/,
    vite: /Vite\s+(\d+\.\d+\.\d+)/,
    vitest: /Vitest\s+(\d+\.\d+\.\d+)/,
    "drizzle-orm": /Drizzle\s+(\d+\.\d+\.\d+)/,
  };
  const verified = [];
  for (const [pkgName, re] of Object.entries(claims)) {
    const m = row.match(re);
    if (!m)
      throw new Error(
        `Dependency Versions row does not name a ${pkgName} version`
      );
    const claimed = m[1];
    const spec = deps[pkgName];
    if (!spec)
      throw new Error(
        `package.json has no "${pkgName}" dependency to compare against`
      );
    const specVersion = String(spec).replace(/^[\^~]/, "");
    if (specVersion !== claimed) {
      throw new Error(
        `README claims ${pkgName} ${claimed} but package.json specifies "${spec}"`
      );
    }
    verified.push(`${pkgName} ${claimed}`);
  }
  return verified.join(", ");
});

// (b) drizzle table inventory: README claim vs drizzle/schema.ts
check("database schema", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const row = findRow(readme, "**Database Schema**");
  if (!row)
    throw new Error(
      'README has no "**Database Schema**" table row to verify against'
    );
  const m = row.match(/(\d+)\s+MySQL tables/);
  if (!m)
    throw new Error(
      'Database Schema row does not state a "<n> MySQL tables" count'
    );
  const claimed = parseInt(m[1], 10);
  const schemaSrc = readFileSync(join(ROOT, "drizzle", "schema.ts"), "utf8");
  const actual = (schemaSrc.match(/mysqlTable\(/g) || []).length;
  if (claimed !== actual) {
    throw new Error(
      `README claims ${claimed} MySQL tables but drizzle/schema.ts declares ${actual}`
    );
  }
  return `${actual} tables`;
});

// (c) test-file count: README claim vs the vitest include set
function collectTestFiles() {
  // Mirrors vitest.config.ts `test.include`:
  //   server/**/*.{test,spec}.ts, client/src/**/*.{test,spec}.{ts,tsx}, shared/**/*.{test,spec}.ts
  const roots = [
    { dir: "server", exts: [".test.ts", ".spec.ts"] },
    {
      dir: join("client", "src"),
      exts: [".test.ts", ".spec.ts", ".test.tsx", ".spec.tsx"],
    },
    { dir: "shared", exts: [".test.ts", ".spec.ts"] },
  ];
  const files = [];
  const walk = dir => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const rel = join(dir, entry);
      const st = statSync(join(ROOT, rel));
      if (st.isDirectory()) walk(rel);
      else if (
        roots.some(
          r => rel.startsWith(r.dir) && r.exts.some(e => entry.endsWith(e))
        )
      ) {
        files.push(rel);
      }
    }
  };
  for (const r of roots) walk(r.dir);
  return files;
}

check("test files", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const row = findRow(readme, "**Unit & Integration Tests**");
  if (!row)
    throw new Error(
      'README has no "**Unit & Integration Tests**" table row to verify against'
    );
  const m = row.match(/\((\d+)\s+files?\)/);
  if (!m)
    throw new Error(
      'Unit & Integration Tests row does not state a "(<n> files)" count'
    );
  const claimed = parseInt(m[1], 10);
  const actual = collectTestFiles().length;
  if (claimed !== actual) {
    throw new Error(
      `README claims ${claimed} test files but the repo has ${actual}`
    );
  }
  return `${actual} files`;
});

for (const p of passes) console.log(`  ok   ${p}`);
if (failures.length > 0) {
  console.error("README drift detected:");
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log("README verification passed.");
