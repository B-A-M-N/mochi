// CI guard: child_process call-site budget (MCH-10 central-exec boundary).
//
// Mochi's canonical process runner is src/exec.ts (argv-only, timeout, tree
// kill, output cap). Every direct child_process call site elsewhere is a
// potential unbounded/hangy spawn — the codebase has legitimate legacy sites,
// but their NUMBER must only ever go DOWN: new code routes through exec.ts.
//
// Like check-skips.mjs, this is a RATCHET: it fails when the count grows past
// the recorded baseline, and the baseline only moves deliberately (with a
// review) when a site is truly unavoidable.
//
// Usage: node scripts/check-proc-sites.mjs [--update-baseline]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = resolve(root, 'scripts', 'proc-sites-baseline.txt');

// Both test depths are tracked (root-level + nested) so the file layout can
// never blindfold the count the way the original skip guard did.
const files = execSync('git ls-files "src/*.ts" "src/**/*.ts"', { cwd: root, encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter((f) => !f.endsWith('.test.ts'));

// Real call sites only: `db.exec(` / `regex.exec(` are NOT child_process.
const CALL = /(?<![.\w])(spawnSync|execFileSync|execFile|spawn|execSync|exec)\s*\(/g;
// `exec(` also matches `db.exec(`, so require the file to import child_process
// AND (for plain `exec`) an actual child_process binding. Pragmatic rule: the
// file must mention child_process, and we count only un-prefixed calls.
let total = 0;
const byFile = [];
for (const f of files) {
  const src = readFileSync(resolve(root, f), 'utf8');
  if (!src.includes('child_process')) continue;
  const n = (src.match(CALL) ?? []).length;
  if (n > 0) {
    total += n;
    byFile.push([f, n]);
  }
}

const baseline = existsSync(baselinePath) ? Number(readFileSync(baselinePath, 'utf8').trim()) : null;

if (process.argv.includes('--update-baseline')) {
  writeFileSync(baselinePath, `${total}\n`);
  console.log(`proc-sites baseline updated: ${total}`);
  process.exit(0);
}

if (baseline === null || Number.isNaN(baseline)) {
  console.error(`proc-sites: no baseline at ${baselinePath}. Run: node scripts/check-proc-sites.mjs --update-baseline`);
  process.exit(1);
}

if (total > baseline) {
  console.error(`proc-sites budget exceeded: ${total} direct child_process call sites > baseline ${baseline}.`);
  console.error('Route new process execution through src/exec.ts (runArgv / runShellString) instead:');
  byFile.sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.error(`  ${String(n).padStart(3)}  ${f}`));
  console.error('If a new site is genuinely unavoidable, raise the baseline deliberately with a review note.');
  process.exit(1);
}

console.log(`proc-sites OK: ${total} direct child_process call sites (baseline ${baseline}, target: fewer)`);
