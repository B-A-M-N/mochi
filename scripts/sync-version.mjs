// Keep version constants in sync with package.json (the source of truth).
// - src/cli.ts `let VERSION` fallback (used by the compiled standalone
//   binary, which has no package.json next to it at runtime).
// - native/mochi_core/Cargo.toml `version` (native helper --help banner).
// Runs automatically as `prebuild:bin`; run manually any time:
//   node scripts/sync-version.mjs
// Idempotent: exits silently when everything already matches.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`sync-version: refusing odd version "${version}"`);
  process.exit(1);
}

let changed = [];

// 1. CLI fallback constant.
{
  const p = resolve(root, 'src', 'cli.ts');
  const src = readFileSync(p, 'utf8');
  const next = src.replace(/^(let VERSION = ')[\d.]+(';)$/m, `$1${version}$2`);
  if (next !== src) {
    writeFileSync(p, next);
    changed.push('src/cli.ts');
  }
}

// 2. Rust crate version (first `version = "..."` under [package]).
{
  const p = resolve(root, 'native', 'mochi_core', 'Cargo.toml');
  try {
    const src = readFileSync(p, 'utf8');
    const next = src.replace(/(^\[package\][\s\S]*?^version = ")[\d.]+(")/m, `$1${version}$2`);
    if (next !== src) {
      writeFileSync(p, next);
      changed.push('native/mochi_core/Cargo.toml');
    }
  } catch {
    console.error('sync-version: native/mochi_core/Cargo.toml not found, skipped');
  }
}

console.log(changed.length ? `sync-version: ${changed.join(', ')} → ${version}` : `sync-version: already at ${version}`);
