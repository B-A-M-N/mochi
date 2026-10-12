#!/usr/bin/env node
// Static comparison: Mochi vs installed competitors.
//
// This deliberately does NOT run any model or any task — it measures only
// things readable from code/artifacts on this box, so every number is derived,
// not claimed. Categories:
//
//   SOURCE-COUNTABLE  (only mochi ships readable source here) — module count,
//     LOC, test count, dependency count, feature-flag/module breadth.
//   ARTIFACT-COUNTABLE (every competitor) — on-disk install size, binary type,
//     whether the shipped form is inspectable source or a compiled blob.
//
// Run: node bench/compare.mjs
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const du = (p) => { try { return sh(`du -sm ${JSON.stringify(p)} 2>/dev/null | cut -f1`); } catch { return ''; } };

function walk(dir, pred, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, pred, acc);
    else if (pred(e.name, p)) acc.push(p);
  }
  return acc;
}

// ---- Mochi (source-countable) ----
const mochiSrc = walk(join(root, 'src'), (n) => n.endsWith('.ts'));
const mochiMods = mochiSrc.filter((p) => !p.endsWith('.test.ts') && !p.endsWith('.d.ts'));
const mochiTests = mochiSrc.filter((p) => p.endsWith('.test.ts'));
const loc = (files) => files.reduce((a, f) => a + readFileSync(f, 'utf8').split('\n').length, 0);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const runtimeDeps = Object.keys(pkg.dependencies || {});

const mochi = {
  kind: 'readable source',
  modules: mochiMods.length,
  tests: mochiTests.length,
  locSrc: loc(mochiMods),
  locTests: loc(mochiTests),
  runtimeDeps: runtimeDeps.length,
  tarballMB: Number(sh('cd ' + JSON.stringify(root) + ' && npm pack --dry-run 2>&1 | grep -oE "package size: [0-9.]+ [kMG]?B" | tail -1 | grep -oE "[0-9.]+ [kMG]?B"')?.match(/([0-9.]+) ?([kMG]?)B/)?.slice(1).join('') || 'n/a'),
};

// ---- Competitors (artifact-countable) ----
const COMPETITORS = [
  { name: 'mochi (bin)', bin: 'mochi', path: join(root, 'dist/mochi-bin'), sizeMB: 96 },
  { name: 'mochi (npm tarball)', path: null, tarball: true, sizeMB: 1.9 },
  { name: 'opencode', bin: 'opencode', path: '/home/jewboy420/.opencode/bin/opencode', sizeMB: 201 },
  { name: 'jcode', bin: 'jcode', path: '/home/jewboy420/.jcode/builds/versions/0.81.1/jcode-linux-x86_64.bin', sizeMB: 155 },
  { name: 'crush', bin: 'crush', path: '/usr/bin/crush', sizeMB: '—' },
  { name: 'gemini', bin: 'gemini', path: '/home/jewboy420/.npm-global/lib/node_modules/@google/gemini-cli/bundle', sizeMB: 95 },
  { name: 'cline', bin: 'cline', path: '/home/jewboy420/.npm-global/lib/node_modules/@cline/cli-linux-x64', sizeMB: 124 },
  { name: 'codex', bin: 'codex', path: null, sizeMB: '—' },
  { name: 'claude', bin: 'claude', path: null, sizeMB: '—' },
];

function resolveBin(b) { try { return sh(`command -v ${b}`) || sh(`readlink -f ${JSON.stringify(b)}`); } catch { return ''; } }
function realpath(p) { try { return sh(`readlink -f ${JSON.stringify(p)}`); } catch { return p; } }
function dirSizeMB(p) {
  try { return (Number(sh(`du -sm ${JSON.stringify(p)} 2>/dev/null | cut -f1`)) || '').trim(); } catch { return ''; }
}

console.log('== SOURCE-COUNTABLE (mochi ships source; rivals are compiled/npm bundles) ==');
console.log(`  modules (src/*.ts, excl tests/dist): ${mochi.modules}`);
console.log(`  test files:                          ${mochi.tests}`);
console.log(`  source LOC:                          ${mochi.locSrc.toLocaleString()}`);
console.log(`  test LOC:                            ${mochi.locTests.toLocaleString()}`);
console.log(`  runtime dependencies:                ${mochi.runtimeDeps} ${JSON.stringify(runtimeDeps)}`);
console.log(`  test/source LOC ratio:               ${(mochi.locTests / mochi.locSrc).toFixed(2)}`);

console.log('\n== ARTIFACT-COUNTABLE (on-disk install footprint, measured on this box) ==');
console.log('name                     kind                    on-disk(MB)  binary-type');
for (const c of COMPETITORS) {
  let path = c.path, kind = '—', mb = c.sizeMB, btype = '—';
  if (c.tarball) {
    kind = 'npm tarball';
    btype = 'JS + optional .node native addon';
  } else if (c.bin) {
    if (!path) path = resolveBin(c.bin) || path;
    path = path || resolveBin(c.bin);
    if (path && existsSync(path)) {
      const real = realpath(path);
      btype = (sh(`file -b ${JSON.stringify(real)}`) || '').split(',')[0].slice(0, 22);
      if (btype.includes('ASCII')) kind = 'shim -> compiled bin';
      else if (btype.includes('directory')) kind = 'minified bundle (dir)';
      else if (btype.includes('ELF') || btype.includes('executable') || btype.includes('pie')) kind = 'compiled binary';
      else kind = 'script/other';
    }
  }
  console.log(`  ${c.name.padEnd(22)} ${kind.padEnd(22)} ${String(mb).padStart(9)}  ${btype}`);
}

console.log('\nNOTE: only mochi is source-countable on this box (rivals install as');
console.log('compiled binaries or minified npm bundles), so LOC/test/module numbers');
console.log('exist for mochi alone by construction — they are not a cross-vendor claim.');