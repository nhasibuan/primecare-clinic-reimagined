/**
 * README ↔ router contract test.
 *
 * `scripts/verifyReadme.mjs` guards counts that can be derived statically
 * (dependency versions, table count, test-file count). The API surface cannot:
 * only the assembled router knows how many procedures exist and what they are
 * called. That gap is exactly how the README drifted to "30 procedures" while
 * the router exposed 32.
 *
 * This test walks the real `appRouter` and holds the README to it in two ways:
 *   1. the documented total (and its domain/system split) matches the router;
 *   2. the API Reference tables list exactly the procedures that exist — no
 *      missing endpoints (undocumented API) and no ghost endpoints
 *      (documentation for procedures that were renamed or removed).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers/index";

const README = readFileSync(join(process.cwd(), "README.md"), "utf8");

/** Every procedure path in the router, e.g. "queue.callNext". */
function collectProcedures(): string[] {
  const found: string[] = [];
  const walk = (node: unknown, prefix: string): void => {
    const def = (node as { _def?: Record<string, unknown> })?._def;
    if (!def) return;
    const procedures = def.procedures as Record<string, unknown> | undefined;
    if (procedures) {
      for (const key of Object.keys(procedures)) found.push(`${prefix}${key}`);
    }
    const record = def.record as Record<string, unknown> | undefined;
    if (record) {
      for (const key of Object.keys(record)) {
        walk(record[key], `${prefix}${key}.`);
      }
    }
  };
  walk(appRouter, "");
  return found.sort();
}

/** The "## API Reference" section, up to the next top-level heading. */
function apiReferenceSection(): string {
  const start = README.indexOf("## API Reference");
  expect(start, "README has no '## API Reference' section").toBeGreaterThan(-1);
  const end = README.indexOf("\n## ", start + 1);
  return README.slice(start, end === -1 ? undefined : end);
}

describe("README API surface", () => {
  const procedures = collectProcedures();

  it("documents the real procedure count in the fact-verification table", () => {
    const row = README.split("\n").find(line =>
      line.includes("**tRPC API Procedures**")
    );
    expect(row, "README has no '**tRPC API Procedures**' row").toBeDefined();

    const total = Number(row!.match(/(\d+)\s+API procedures/)?.[1]);
    const split = row!.match(/(\d+)\s+domain\s*\+\s*(\d+)\s+system/);
    expect(split, "row must state '<n> domain + <n> system'").not.toBeNull();

    const domain = procedures.filter(p => !p.startsWith("system."));
    const system = procedures.filter(p => p.startsWith("system."));

    expect(total).toBe(procedures.length);
    expect(Number(split![1])).toBe(domain.length);
    expect(Number(split![2])).toBe(system.length);
  });

  it("keeps the architecture diagram's procedure count honest", () => {
    // The Mermaid diagram is the first thing a reader sees; it drifted to
    // "30 procedures" alongside the fact table, so it is held to the same
    // number here.
    const domain = procedures.filter(p => !p.startsWith("system.")).length;
    const system = procedures.length - domain;
    expect(README).toContain(
      `${domain} procedures across 7 domains + ${system} system`
    );
  });

  it("lists exactly the procedures that exist in the API Reference tables", () => {
    const section = apiReferenceSection();
    const documented = [
      ...new Set(
        [...section.matchAll(/`([a-zA-Z]+\.[a-zA-Z]+)`/g)].map(m => m[1])
      ),
    ].sort();

    const undocumented = procedures.filter(p => !documented.includes(p));
    const ghosts = documented.filter(p => !procedures.includes(p));

    expect(undocumented, "procedures missing from the README tables").toEqual(
      []
    );
    expect(ghosts, "documented procedures that no longer exist").toEqual([]);
  });

  it("keeps every documented procedure path in a real sub-router", () => {
    const domains = new Set(procedures.map(p => p.split(".")[0]));
    for (const path of procedures) {
      expect(path).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      expect(domains.has(path.split(".")[0])).toBe(true);
    }
  });
});
