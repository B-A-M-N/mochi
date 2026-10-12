#!/usr/bin/env node
// Portable native-accelerator build.
//
// The previous shell one-liner only ran on POSIX: on Windows, npm spawns
// cmd.exe for package scripts, where `mkdir -p` / `cp --remove-destination`
// die with "The syntax of the command is incorrect" — which killed the CI
// Windows leg the moment it started running. Every step here is best-effort:
// a missing toolchain (g++ on some runners, cargo in minimal containers)
// degrades parity features instead of failing the build. CI separately
// asserts that the binaries exist when both toolchains are present.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bin = resolve(root, 'native', 'bin');
mkdirSync(bin, { recursive: true });

const isWin = process.platform === 'win32';
const exe = (n) => (isWin ? `${n}.exe` : n);
const sh = (cmd, args) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit' }).status === 0;
const best = (label, fn) => {
  let ok = false;
  try { ok = fn(); } catch { ok = false; }
  if (!ok) console.warn(`build:native: ${label} unavailable — parity features degrade`);
  return ok;
};
const copy = (from, to) => {
  try { copyFileSync(from, resolve(bin, to)); return true; } catch { return false; }
};

// 1. Rust core: mochi_core cdylib (loaded as mochi_core.node) + mochi-agent CLI.
best('cargo (mochi_core)', () => {
  if (!sh('cargo', ['build', '--release', '--manifest-path', 'native/mochi_core/Cargo.toml'])) return false;
  const out = resolve(root, 'native', 'mochi_core', 'target', 'release');
  // Windows emits .dll / .exe; node loads a Rust cdylib .dll just fine as .node.
  const libName = isWin ? 'mochi_core.dll' : 'libmochi_core.so';
  return copy(resolve(out, exe('mochi-agent')), exe('mochi-agent')) &&
         copy(resolve(out, libName), 'mochi_core.node') &&
         copy(resolve(out, libName), libName);
});

// 2. Single-file rust accelerators.
best('rustc fuzzy', () => sh('rustc', ['-O', '-o', resolve(bin, exe('fuzzy_rust')), resolve(root, 'native', 'rust', 'fuzzy.rs')]));
best('rustc search', () => sh('rustc', ['-O', '-o', resolve(bin, exe('search_rust')), resolve(root, 'native', 'rust', 'search.rs')]));

// 3. C++ fallback accelerator.
best('g++ fuzzy_cpp', () => sh('g++', ['-O2', '-std=c++17', '-o', resolve(bin, exe('fuzzy_cpp')), resolve(root, 'native', 'cpp', 'fuzzy.cpp')]));

// 4. Strip release symbols (unstripped: 26.6MB, stripped: 800KB). Optional.
const stripTargets = ['fuzzy_rust', 'search_rust', 'mochi-agent', 'mochi_core.node', 'libmochi_core.so']
  .flatMap((n) => [resolve(bin, n), resolve(bin, `${n}.exe`)])
  .filter((p) => existsSync(p));
if (stripTargets.length) sh('strip', stripTargets);
