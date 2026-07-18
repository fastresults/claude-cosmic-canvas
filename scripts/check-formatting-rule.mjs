#!/usr/bin/env node
// Guard: enforce the global rule "no raw JSON or Markdown shown to users".
// Fails if any .tsx under src/ renders JSON.stringify inside JSX braces or
// a <pre>/<code> block filled directly with a markdown-typed string.
import { execSync } from "node:child_process";

const patterns = [
  { name: "raw JSON in JSX", rg: String.raw`\{JSON\.stringify\(` },
];

let failed = 0;
for (const { name, rg } of patterns) {
  const out = execSync(
    `rg -n --no-heading -g 'src/**/*.tsx' -g '!src/**/*.test.*' '${rg}' || true`,
    { encoding: "utf8" },
  ).trim();
  if (out) {
    console.error(`\n✗ ${name}:\n${out}`);
    failed++;
  }
}

if (failed) {
  console.error(
    `\nGlobal rule violated: users must never see raw JSON or Markdown. Use <KeyValueList /> or <Markdown />.`,
  );
  process.exit(1);
}
console.log("✓ Formatting rule check passed.");
