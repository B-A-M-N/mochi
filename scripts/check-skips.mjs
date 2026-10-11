// CI guard: static skip-marker budget. Conditional runtime skips (sqlite /
// toolchain / live gates) are legitimate, but every NEW static skip marker
// silently shrinks what CI actually verifies. This script counts skip markers
// and fails when the count grows past the recorded baseline — update the
// baseline file deliberately, with a reason, when a skip is truly needed.
//
// Usage: node scripts/check-skips.mjs [--update-baseline]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = resolve(root, 'scripts', 'skip-baseline.txt');

const files = execSync('git ls-files "src/**/*.test.ts"', { cwd: root, encoding: 'utf8' })
  .split('\n').filter(Boolean);

const patterns = [
  /\.skip\(/, /describe\.skip/, /it\.skip/, /test\.skip/,
  /skipIf\(/, /describe\.skipIf/, /it\.skipIf/,
  /test\.only/, /it\.only/, /describe\.only/,
];
let total = 0;
const hits = [];
for (const f of files) {
  const src = readFileSync(resolve(root, f), 'utf8');
  src.split('\n').forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    if (patterns.some((p) => p.test(line))) {
      total++;
      hits.push(`${f}:${i + 1}:${line.trim().slice(0, 80)}`);
    }
  });
}

if (process.argv.includes('--update-baseline')) {
  writeFileSync(baselinePath, `${total}\n`);
  console.log(`skip baseline updated: ${total}`);
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? Number(readFileSync(baselinePath, 'utf8').trim()) : total;
console.log(`skip markers: ${total} (baseline ${baseline})`);
if (total > baseline) {
  console.error(`\nFAIL: ${total - baseline} new skip marker(s) since baseline. Remove them or run \`node scripts/check-skips.mjs --update-baseline\` with a justification.`);
  for (const h of hits.slice(0, 20)) console.error(`  ${h}`);
  process.exit(1);
}
console.log('skip budget OK');
