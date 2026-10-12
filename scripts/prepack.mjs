#!/usr/bin/env node
// prepack: guarantee shippable artifacts exist before `npm pack`/`npm publish`.
// `dist/` and `native/bin/` are gitignored, so a clean tree has NO build output —
// publishing straight from a fresh clone previously shipped a 4-file tarball
// (LICENSE + README + package.json) with no agent inside. This hook makes that
// impossible: TS output, native helpers (when a toolchain is present), and the
// standalone binary are all built as part of packing.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

run('npm run build');

// Natives are best-effort (parity features degrade gracefully without them),
// but the release gate asserts they ship — build when missing, don't rebuild
// an already-present binary.
if (!existsSync(resolve(root, 'native/bin/mochi_core.node'))) {
  mkdirSync(resolve(root, 'native/bin'), { recursive: true });
  try {
    run('npm run build:native');
  } catch {
    console.warn('prepack: native build failed — parity features will be absent');
  }
}

run('npm run build:bin');
