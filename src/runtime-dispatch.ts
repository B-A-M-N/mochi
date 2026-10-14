// Engine selection for `mochi node` / `mochi standalone` / `mochi runtime`.
//
// Mochi has two shippable engines and one dispatcher:
//   * **node**       — `dist/cli.js` under Node (npm installs, dev checkouts)
//   * **standalone** — the Bun-compiled binary (release installs)
//   * **dispatcher** — the Rust launcher (`native/bin/mochi`) which owns
//     `--version` / `runtime` outright and execs the freshest engine.
//
// This module exists so the *same* subcommands behave identically when the
// entry point is the TS CLI directly (npm bin, `node dist/cli.js`, the
// standalone binary, `tsx src/cli.ts`) — the launcher is an accelerator in
// front, never a behavior change. Pure discovery/formatting is kept free of
// side effects so tests can drive it.

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Engine = 'node' | 'standalone';

/** The engine THIS process is. Bun (compiled binary or `bun run`) is the
 *  standalone engine; Node is the node engine. */
export function currentEngine(): 'node' | 'bun' {
  return (process.versions as Record<string, string | undefined>).bun ? 'bun' : 'node';
}

function exeName(base: string): string {
  return process.platform === 'win32' ? `${base}.exe` : base;
}

function entryDir(): string {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    // Compiled binary: import.meta.url is a virtual path with no directory
    // semantics worth resolving against.
    return '';
  }
}

/** Walk `start` and its parents for `<dir>/<rel>` (bounded), like the Rust launcher. */
function ascendFind(start: string, rel: string): string | null {
  if (!start) return null;
  let dir: string | null = start;
  for (let i = 0; i < 6 && dir; i++) {
    const hit = join(dir, rel);
    if (existsSync(hit)) return hit;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Every standalone-binary candidate, in discovery order (existing files only,
 *  except the report's "looked for" list which uses `standaloneCandidates`). */
export function findStandalone(): string | null {
  if (process.env.MOCHI_STANDALONE) {
    return existsSync(process.env.MOCHI_STANDALONE) ? process.env.MOCHI_STANDALONE : null;
  }
  const here = entryDir();
  const exeDir = process.execPath ? dirname(process.execPath) : '';
  const candidates = [
    exeDir && join(exeDir, exeName('mochi-standalone')),
    exeDir && join(exeDir, exeName('mochi-bin')),
    here && join(here, exeName('mochi-bin')), // dist/cli.js sits next to it
    ascendFind(here, exeName('dist/mochi-bin')),
    join(homedir(), '.local', 'bin', exeName('mochi-standalone')),
    join(homedir(), 'mochi', 'dist', exeName('mochi-bin')),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Every node-entry candidate (existing files only). */
export function findNodeEntry(): string | null {
  if (process.env.MOCHI_NODE_ENTRY) {
    return existsSync(process.env.MOCHI_NODE_ENTRY) ? process.env.MOCHI_NODE_ENTRY : null;
  }
  const here = entryDir();
  const exeDir = process.execPath ? dirname(process.execPath) : '';
  const candidates = [
    join(exeDir, '..', 'lib', 'node_modules', '@mochi', 'agent', 'dist', 'cli.js'),
    here && join(here, 'cli.js'), // already the node entry (dist/cli.js)
    ascendFind(here, join('dist', 'cli.js')),
    ascendFind(here, 'cli.js'),
    join(homedir(), 'mochi', 'dist', 'cli.js'),
    join(homedir(), '.local', 'lib', 'node_modules', '@mochi', 'agent', 'dist', 'cli.js'),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => existsSync(p)) ?? null;
}

export interface RuntimeReport {
  version: string;
  /** `rust` when the Rust launcher exec'd us (MOCHI_LAUNCHER), else `none`. */
  launcher: string;
  /** Engine of the CURRENT process. */
  engine: 'node' | 'bun';
  engineDetail: string;
  /** Where this process's code came from (file URL or virtual path). */
  entry: string;
  /** Engine the Rust launcher selected before exec (MOCHI_ACTIVE_ENGINE). */
  selectedEngine: string | null;
  /** Executable that would run `mochi node`. */
  nodeEntry: string | null;
  /** Executable that would run `mochi standalone`. */
  standalone: string | null;
  nativeCore: { path: string | null; version: string | null };
}

async function nativeCoreVersion(): Promise<string | null> {
  try {
    const { rustRuntimeVersion } = await import('./native/agent-protocol.js');
    return await rustRuntimeVersion();
  } catch {
    return null;
  }
}

export async function runtimeReport(version: string): Promise<RuntimeReport> {
  const engine = currentEngine();
  const bun = (process.versions as Record<string, string | undefined>).bun;
  return {
    version,
    launcher: process.env.MOCHI_LAUNCHER ?? 'none',
    engine,
    engineDetail: bun ? `bun ${bun}` : `node ${process.version}`,
    entry: (() => { try { return fileURLToPath(import.meta.url); } catch { return String(import.meta.url); } })(),
    selectedEngine: process.env.MOCHI_ACTIVE_ENGINE ?? null,
    nodeEntry: findNodeEntry(),
    standalone: findStandalone(),
    nativeCore: {
      path: process.env.MOCHI_AGENT_BIN && existsSync(process.env.MOCHI_AGENT_BIN)
        ? process.env.MOCHI_AGENT_BIN
        : null,
      version: await nativeCoreVersion(),
    },
  };
}

export function formatRuntimeReport(r: RuntimeReport): string {
  const lines: string[] = [];
  lines.push(`Mochi ${r.version} — runtime`);
  lines.push(`  engine:      ${r.engineDetail} (${r.engine})`);
  lines.push(`  launcher:    ${r.launcher === 'rust' ? 'rust' : 'none (TS entry invoked directly)'}`);
  if (r.selectedEngine) lines.push(`  selected:    ${r.selectedEngine} (by the rust launcher)`);
  lines.push(`  entry:       ${r.entry}`);
  lines.push(`  mochi node:  ${r.nodeEntry ?? '(not built — `npm run build`)'}`);
  lines.push(`  mochi standalone: ${r.standalone ?? '(not built — `npm run build:bin`)'}`);
  lines.push(
    `  rust core:   ${r.nativeCore.path ? `${r.nativeCore.path} (${r.nativeCore.version ?? 'unreachable'})` : '(not found — hot paths run in TS)'}`,
  );
  lines.push('  force:       mochi node … | mochi standalone … | MOCHI_RUNTIME=node|standalone');
  return lines.join('\n');
}

export interface EngineArgResult {
  /** true → caller should drop the subcommand and run normally. */
  continue: boolean;
  /** exit code when the subcommand was handled by spawning (never null when continue=false). */
  exitCode: number | null;
}

/**
 * Handle `mochi <engine>` when THIS process is already the entry.
 * Spawns the requested engine with `rest` (raw argv tail) when we are not it.
 */
export function handleEngineArg(engine: Engine, rest: string[]): EngineArgResult {
  const mine = currentEngine();
  const wanted = engine === 'node' ? 'node' : 'bun';
  if (mine === wanted) {
    return { continue: true, exitCode: null };
  }
  if (engine === 'node') {
    const entry = findNodeEntry();
    if (!entry) {
      console.error('mochi node: no node entry found (looked for dist/cli.js).\n  Build one with `npm run build`, or pin it with MOCHI_NODE_ENTRY=<path>.');
      return { continue: false, exitCode: 127 };
    }
    const nodeBin = process.env.MOCHI_NODE || 'node';
    const r = spawnSync(nodeBin, [entry, ...rest], { stdio: 'inherit' });
    if (r.error && (r.error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`mochi node: \`${nodeBin}\` is not on PATH (entry ${entry} was found).`);
      return { continue: false, exitCode: 127 };
    }
    return { continue: false, exitCode: r.status ?? (r.signal ? 130 : 1) };
  }
  const bin = findStandalone();
  if (!bin) {
    console.error('mochi standalone: no standalone binary found (looked for dist/mochi-bin / mochi-standalone).\n  Build one with `npm run build:bin`, or pin it with MOCHI_STANDALONE=<path>.');
    return { continue: false, exitCode: 127 };
  }
  const r = spawnSync(bin, rest, { stdio: 'inherit' });
  if (r.error) {
    console.error(`mochi standalone: ${bin} failed to start (${(r.error as Error).message}).`);
    return { continue: false, exitCode: 127 };
  }
  if (r.status === null && !r.signal) {
    console.error(`mochi standalone: ${bin} exited without a status — trying again is unlikely to help; run \`mochi runtime\`.`);
    return { continue: false, exitCode: 127 };
  }
  return { continue: false, exitCode: r.status ?? 130 };
}

/** mtime of a file in seconds, or null (for report/JSON consumers). */
export function fileAgeSecs(path: string | null): number | null {
  if (!path) return null;
  try {
    const m = statSync(path).mtimeMs;
    return Math.max(0, Math.round((Date.now() - m) / 1000));
  } catch {
    return null;
  }
}
