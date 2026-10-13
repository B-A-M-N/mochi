// Release readiness gate (`npm run release:check`): verifies everything that
// must hold BEFORE `npm publish` — clean tree, version/changelog coherence,
// typecheck, full test suite, tarball contents (and that the standalone
// binary exists, runs, and stays out of the tarball). Read-only except for
// running checks; never publishes. Usage: node scripts/release-check.mjs [--skip-tests]
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
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
if (!changelog.includes(`## ${pkg.version}`) && !changelog.includes(`## [${pkg.version}]`)) fail(`CHANGELOG has no ## ${pkg.version} section`);
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
  // Exit-code truth: the old `npx vitest run 2>&1 | tail -n 5` + grep waved
  // RED suites through as green — the tail window dropped the summary lines
  // and the pipeline's exit status was tail's (0), never vitest's. Now the
  // non-zero exit fails the gate directly, and the summary is grepped from a
  // full log file (belt + suspenders: nonzero exit OR /failed/ in summary).
  const suiteLog = resolve(tmpdir(), `mochi-release-suite-${process.pid}.log`);
  let suiteFailed = false;
  try {
    execSync(`npx vitest run --reporter=basic > "${suiteLog}" 2>&1`, { cwd: root, timeout: 600_000 });
  } catch {
    suiteFailed = true;
  }
  let summary = '';
  let failingFiles = [];
  try {
    const log = readFileSync(suiteLog, 'utf8');
    summary = log.split('\n')
      .filter((l) => l.includes('Test Files') || l.includes('Tests  '))
      .join(' ');
    // Failing file names for a one-glance verdict (flake vs real): vitest
    // prints `FAIL <file> …` lines for both assertion failures and worker
    // crashes. Cap at 5; the full log path is printed too.
    const seen = new Set();
    for (const line of log.split('\n')) {
      const m = /FAIL\s+(\S+\.test\.ts)/.exec(line);
      if (m && !seen.has(m[1]) && seen.size < 5) { seen.add(m[1]); failingFiles.push(m[1]); }
    }
    if (/Unhandled Errors/i.test(log)) failingFiles.push('(unhandled worker error — see log)');
  } catch { /* unreadable log: exit code alone decides */ }
  if (suiteFailed || /failed/i.test(summary)) {
    const detail = [summary.trim().slice(0, 120), failingFiles.length ? `files: ${failingFiles.join(', ')}` : '', `log: ${suiteLog}`]
      .filter(Boolean).join(' | ');
    fail(`full test suite has failures${detail ? ` (${detail})` : ''}`);
    // Keep the log for inspection on failure; delete only on success.
  } else {
    try { unlinkSync(suiteLog); } catch { /* best-effort */ }
    ok(`full test suite green${summary ? ` (${summary.trim().slice(0, 160)})` : ''}`);
  }
}

// 5. Tarball contents: runtime ships, source/tests/secrets stay out.
// npm prints the file listing on STDERR and only lifecycle logs on STDOUT —
// merge both (a stdout-only capture once "passed" the cli.js check because
// the prepack log line contained `chmod +x dist/cli.js`).
const pack = run('npm pack --dry-run 2>&1');
if (pack === null) fail('npm pack --dry-run failed');
else {
  const checks = [
    ['dist/cli.js', true],
    ['dist/index.js', true],
    ['native/bin/mochi_core.node', true],
    ['src/', false],
    ['.test.ts', false],
    ['testutil', false],
    ['.env', false],
  ];
  // npm's notice lines list tarball paths either bare (`dist/cli.js`) or
  // prefixed (`package/dist/cli.js`) depending on npm version — match both
  // as whole tokens so `dist/cli.js` can't be satisfied by `dist/cli.js.map`.
  const tokenHit = (needle) =>
    new RegExp(`(?:^|\\s)(?:package/)?${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'm').test(pack);
  let bad = false;
  for (const [needle, want] of checks) {
    const has = needle === '.env'
      ? /(?:^|\s)(?:package\/)?[^ ]*\.env(?:\s|$)/m.test(pack) // real file, not 'dotenv' docs
      : tokenHit(needle);
    if (has !== want) {
      fail(`tarball ${want ? 'missing' : 'leaks'}: ${needle}`);
      bad = true;
    }
  }
  if (!bad) ok('tarball contents correct (runtime in, source/tests out)');
}

// 6. Standalone binary (dist/mochi-bin): prepack just built it — it must
// exist, RUN, and print the right version. This gate previously never touched
// the binary, so a broken build:bin would ship silently. Note the binary is
// for standalone installs only; npm users get dist/cli.js under node.
const binPath = resolve(root, process.platform === 'win32' ? 'dist/mochi-bin.exe' : 'dist/mochi-bin');
if (!existsSync(binPath)) fail('dist/mochi-bin missing after prepack (build:bin broken)');
else {
  const binOut = run(`"${binPath}" --version 2>&1`);
  if (binOut === null) fail('standalone binary exists but fails to run');
  else if (binOut.trim() !== pkg.version) fail(`standalone binary --version = ${JSON.stringify(binOut.trim())}, expected ${pkg.version}`);
  else ok(`standalone binary runs (v${pkg.version})`);
}

// 7. Tarball must NOT contain the standalone binary (~100MB bun runtime +
// app; npm runs dist/cli.js under node). Checked via the JSON listing with
// --ignore-scripts: prepack already ran in step 5 and must not run twice.
const packJson = run('npm pack --dry-run --json --ignore-scripts 2>&1');
if (packJson === null) fail('npm pack --dry-run --json failed');
else {
  try {
    const files = JSON.parse(packJson.slice(packJson.indexOf('[')))[0].files.map((f) => f.path);
    if (files.some((f) => /mochi-bin(\.exe)?$/.test(f))) fail(`tarball leaks standalone binary (${files.filter((f) => /mochi-bin/.test(f)).join(', ')})`);
    else ok('tarball excludes the standalone binary');
  } catch {
    fail('could not parse npm pack --json output');
  }
}

console.log(failures.length ? `\n${failures.length} release blocker(s).` : '\nRelease ready: npm login && npm publish');
process.exit(failures.length ? 1 : 0);
