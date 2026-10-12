// Release readiness gate (`npm run release:check`): verifies everything that
// must hold BEFORE `npm publish` — clean tree, version/changelog coherence,
// typecheck, full test suite, tarball contents. Read-only except for running
// checks; never publishes. Usage: node scripts/release-check.mjs [--skip-tests]
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const ok = (msg) => console.log(`  ok    ${msg}`);
const fail = (msg) => { failures.push(msg); console.log(`  FAIL  ${msg}`); };
const run = (cmd, opts = {}) => {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', timeout: 600_000, ...opts });
  } catch (e) {
    return null;
  }
};

console.log('mochi release check');

// 1. Clean tree (publish builds from the working tree — dirty state ships).
const dirty = run('git status --porcelain');
if (dirty === null) fail('git status failed');
else if (dirty.trim()) fail(`working tree dirty:\n${dirty.split('\n').slice(0, 10).join('\n')}`);
else ok('working tree clean');

// 2. Version coherence: package.json + CHANGELOG + baked fallback agree.
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
if (!changelog.includes(`## ${pkg.version}`)) fail(`CHANGELOG has no ## ${pkg.version} section`);
else ok(`CHANGELOG covers ${pkg.version}`);
const cliSrc = readFileSync(resolve(root, 'src/cli.ts'), 'utf8');
const m = cliSrc.match(/^let VERSION = '([^']+)'/m);
if (!m) fail('src/cli.ts VERSION fallback not found');
else if (m[1] !== pkg.version) fail(`VERSION fallback ${m[1]} != package.json ${pkg.version} (run node scripts/sync-version.mjs)`);
else ok(`VERSION fallback matches ${pkg.version}`);

// 3. Typecheck.
if (run('npx tsc --noEmit') === null) fail('tsc --noEmit failed');
else ok('typecheck clean');

// 4. Full test suite (slow; --skip-tests bypasses for a quick metadata check).
if (process.argv.includes('--skip-tests')) {
  console.log('  skip  full test suite (--skip-tests)');
} else {
  const out = run('npx vitest run 2>&1 | tail -n 5');
  if (out === null || /failed/i.test(out.split('\n').filter((l) => l.includes('Test Files') || l.includes('Tests ')).join(' '))) {
    fail('full test suite has failures');
  } else {
    ok('full test suite green');
  }
}

// 5. Tarball contents: runtime ships, source/tests/secrets stay out.
const pack = run('npm pack --dry-run');
if (pack === null) fail('npm pack --dry-run failed');
else {
  const checks = [
    ['package/dist/cli.js', true],
    ['package/dist/index.js', true],
    ['package/native/bin/mochi_core.node', true],
    ['package/src/', false],
    ['.test.ts', false],
    ['.env', false],
  ];
  let bad = false;
  for (const [needle, want] of checks) {
    const has = pack.includes(needle);
    if (has !== want) {
      // .env matches many legit names (dotenv docs); only fail on real leaks.
      if (needle === '.env' && !/package\/[^ ]*\.env(\s|$)/.test(pack)) continue;
      fail(`tarball ${want ? 'missing' : 'leaks'}: ${needle}`);
      bad = true;
    }
  }
  if (!bad) ok('tarball contents correct (runtime in, source/tests out)');
}

console.log(failures.length ? `\n${failures.length} release blocker(s).` : '\nRelease ready: npm login && npm publish');
process.exit(failures.length ? 1 : 0);
