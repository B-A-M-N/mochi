#!/usr/bin/env node
// Package a built standalone binary into a platform release archive.
// Usage: node scripts/package-release.mjs --version <v> --os <linux|darwin|windows> --arch <x64|arm64> --bin <path> [--out <dir>]
import { execFileSync, execSync } from 'node:child_process';
import { accessSync, constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fail = (msg) => { console.error(`package-release: ${msg}`); process.exit(1); };
const warn = (msg) => console.warn(`package-release: warning: ${msg}`);
const argv = process.argv.slice(2);
const get = (k) => { const i = argv.indexOf(`--${k}`); return i === -1 ? null : argv[i + 1] ?? null; };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let version = get('version'), os = get('os'), arch = get('arch'), bin = get('bin');
const outDir = resolve(get('out') ?? join(process.cwd(), 'releases'));
if (!version || !os || !arch || !bin) fail('usage: --version <v> --os <linux|darwin|windows> --arch <x64|arm64> --bin <path> [--out <dir>]');
version = version.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+/.test(version)) fail(`bad --version "${version}" (want semver like 0.23.0)`);
if (!['linux', 'darwin', 'windows'].includes(os)) fail(`bad --os "${os}" (want linux|darwin|windows)`);
if (!['x64', 'arm64'].includes(arch)) fail(`bad --arch "${arch}" (want x64|arm64)`);
bin = resolve(bin);
if (!existsSync(bin) || !statSync(bin).isFile()) fail(`--bin not found: ${bin}`);
if (os !== 'windows') {
  try { accessSync(bin, constants.X_OK); } catch { fail(`--bin not executable: ${bin} (chmod +x?)`); }
}

// Binary identity: host-runnable targets must execute and report a version;
// cross-targets can't execute here, so verify magic bytes instead (the
// native smoke legs in release.yml execute them on real hardware).
const hostOs = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux';
const hostArch = process.arch === 'arm64' ? 'arm64' : 'x64';
const MAGIC = {
  linux: ['7f454c46'], // ELF
  windows: ['4d5a'], // MZ
  darwin: ['cffaedfe', 'cefaedfe', 'cafebabe', 'cafebabf', 'feedface', 'feedfacf'],
};
try {
  const head = readFileSync(bin).subarray(0, 4).toString('hex');
  const want = MAGIC[os] ?? [];
  if (!want.some((sig) => head.startsWith(sig))) fail(`--bin magic mismatch for ${os}: got ${head} (not a ${os} executable?)`);
} catch (e) {
  if (e instanceof Error && e.message.startsWith('--bin magic')) throw e;
  fail(`could not read --bin magic: ${(e instanceof Error ? e.message : e)}`);
}
if (os === hostOs && arch === hostArch) {
  let printed;
  try {
    printed = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 30_000 }).trim();
  } catch (e) { fail(`"${bin} --version" failed: ${e.message}`); }
  const m = printed.match(/\d+\.\d+\.\d+/);
  if (!m) fail(`"${bin} --version" printed no semver: ${JSON.stringify(printed)}`);
  if (!printed.includes(version)) warn(`binary reports ${m[0]} but --version ${version} was requested`);
} else {
  warn(`cross-target ${os}-${arch}: skipping execution check (native smoke legs verify on hardware)`);
}

// Stage: binary + docs. install scripts are best-effort (absent in npm-era trees).
const stage = mkdtempSync(join(tmpdir(), 'mochi-release-'));
const binName = os === 'windows' ? 'mochi.exe' : 'mochi';
const staged = [binName, 'README.md', 'LICENSE'];
try {
  copyFileSync(bin, join(stage, binName));
  for (const f of ['README.md', 'LICENSE']) {
    const src = join(root, f);
    if (!existsSync(src)) fail(`${f} missing in repo root`);
    copyFileSync(src, join(stage, f));
  }
  for (const f of ['install.sh', 'install.ps1']) {
    if (existsSync(join(root, f))) { copyFileSync(join(root, f), join(stage, f)); staged.push(f); }
    else warn(`${f} absent in repo root, skipped`);
  }

  // Archive: tar.gz on unix, zip on windows (requires the `zip` binary).
  mkdirSync(outDir, { recursive: true });
  const base = `mochi-${version}-${os}-${arch}`;
  const asset = join(outDir, os === 'windows' ? `${base}.zip` : `${base}.tar.gz`);
  if (os === 'windows') {
    try { execSync('command -v zip', { stdio: 'ignore', shell: '/bin/sh' }); }
    catch { fail('`zip` binary not found — install zip to package windows releases'); }
    execSync(`zip -j "${asset}" ${staged.map((f) => `"${join(stage, f)}"`).join(' ')}`, { stdio: 'pipe' });
  } else {
    execSync(`tar -czf "${asset}" -C "${stage}" ${staged.join(' ')}`, { stdio: 'pipe' });
  }
  const sha256 = createHash('sha256').update(readFileSync(asset)).digest('hex');
  console.log(`asset: ${asset}`);
  console.log(`sha256: ${sha256}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
