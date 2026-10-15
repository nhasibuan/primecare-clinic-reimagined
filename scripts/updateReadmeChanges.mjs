#!/usr/bin/env node
/**
 * README "Recent Changes" generator.
 *
 * Keeps the README's change log in step with main without anyone remembering
 * to edit it: renders the newest commits (hash, date, subject) between the
 * `recent-changes` markers and rewrites that block in place.
 *
 * Usage:
 *   node scripts/updateReadmeChanges.mjs            # rewrite in place
 *   node scripts/updateReadmeChanges.mjs --check    # exit 1 if it would change
 *
 * Wired as `pnpm docs:changes` and run on every push to main by
 * .github/workflows/readme-changes.yml (which commits the result back, so the
 * README is updated "automatically" rather than by hand).
 *
 * Idempotence matters here: the workflow commits its own output, so the
 * generator must produce byte-identical text when run again on the new HEAD,
 * otherwise every run would spawn another commit. Auto-commits are therefore
 * filtered out of the input by their marker (AUTO_COMMIT_MARKER), and the
 * emitted block contains no timestamps of its own.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const README_PATH = join(ROOT, "README.md");
const START = "<!-- recent-changes:start -->";
const END = "<!-- recent-changes:end -->";

/** Subject line of the workflow's own commit; never listed, never counted. */
export const AUTO_COMMIT_MARKER = "chore(docs): refresh README recent changes";

/** How many commits the block shows. */
const MAX_ENTRIES = 10;

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

/**
 * Newest commits, excluding the generator's own output commits. Uses a unit
 * separator so subjects containing pipes or dashes cannot corrupt parsing.
 */
function recentCommits() {
  const raw = git([
    "log",
    `--max-count=${MAX_ENTRIES + 5}`, // headroom for filtered auto-commits
    "--date=short",
    "--pretty=format:%h%x1f%ad%x1f%s%x1e",
  ]);
  return raw
    .split("\x1e")
    .map(chunk => chunk.replace(/^\n/, ""))
    .filter(Boolean)
    .map(chunk => {
      const [hash, date, subject] = chunk.split("\x1f");
      return { hash, date, subject };
    })
    .filter(commit => !commit.subject.includes(AUTO_COMMIT_MARKER))
    .slice(0, MAX_ENTRIES);
}

function renderBlock(commits) {
  const entries = commits.map(({ hash, date, subject }) => {
    // Escape markdown-special characters so a commit subject cannot break the
    // list rendering (e.g. a bare "|" or an unbalanced `*`).
    const safe = subject.replace(/([|*_`<>])/g, "\\$1");
    return `- \`${hash}\` · ${date} · ${safe}`;
  });
  if (entries.length === 0) entries.push("- No commits recorded yet.");

  // Both markers are re-emitted: the marker pair is the generator's contract
  // with itself, and dropping END on the first run would make every later run
  // fail with "markers missing".
  return [
    START,
    "",
    "_Auto-generated from the last commits on `main` by `pnpm docs:changes` — do not edit by hand._",
    "",
    ...entries,
    END,
  ].join("\n");
}

export function applyRecentChanges(readme, commits) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `README.md is missing the ${START} / ${END} markers the generator writes between`
    );
  }
  const block = renderBlock(commits);
  return readme.slice(0, start) + block + readme.slice(end + END.length);
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const readme = readFileSync(README_PATH, "utf8");
  const commits = recentCommits();
  const updated = applyRecentChanges(readme, commits);

  if (updated === readme) {
    console.log(
      `README recent changes already current (${commits.length} entries).`
    );
    return;
  }
  if (checkOnly) {
    console.error("README recent changes are stale — run: pnpm docs:changes");
    process.exit(1);
  }
  writeFileSync(README_PATH, updated);
  console.log(`README recent changes updated (${commits.length} entries).`);
}

// Only run when invoked directly (the module is importable for tests/tools).
if (process.argv[1] && process.argv[1].endsWith("updateReadmeChanges.mjs")) {
  main();
}
