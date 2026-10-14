// Engine dispatch: `mochi node`, `mochi standalone`, `mochi runtime`.
// These subcommands must behave identically from every entry point (Rust
// launcher, npm bin, dist/cli.js, standalone binary) — the launcher strips
// them first, this layer is the TS-side twin.
import { describe, it, expect, afterEach } from 'vitest';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  currentEngine,
  findNodeEntry,
  findStandalone,
  handleEngineArg,
  runtimeReport,
  formatRuntimeReport,
  fileAgeSecs,
} from './runtime-dispatch.js';

const PINNED = ['MOCHI_STANDALONE', 'MOCHI_NODE_ENTRY', 'MOCHI_NO_NATIVE', 'MOCHI_LAUNCHER', 'MOCHI_ACTIVE_ENGINE'] as const;
const saved = new Map<string, string | undefined>();
const tmpDirs: string[] = [];

function pin(name: string, value: string | undefined): void {
  if (!saved.has(name)) saved.set(name, process.env[name]);
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function tmpFile(name: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mochi-dispatch-'));
  tmpDirs.push(dir);
  const p = join(dir, name);
  writeFileSync(p, body);
  return p;
}

/** Executable fixture that spawnSync can actually launch on every OS: a
 *  shebang script on posix, a .cmd batch file on Windows (CreateProcess
 *  cannot execute extensionless scripts — the bare-sh fixture ENOENTs and
 *  the test reads 127 instead of the scripted exit code). */
function tmpExec(exitCode: number, marker?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mochi-dispatch-'));
  tmpDirs.push(dir);
  if (process.platform === 'win32') {
    const p = join(dir, 'mochi-standalone.cmd');
    const lines = ['@echo off'];
    if (marker) lines.push(`:loop`, `if "%~1"=="" goto done`, `echo %~1>> "${marker}"`, `shift`, `goto loop`, `:done`);
    lines.push(`exit ${exitCode}`);
    writeFileSync(p, lines.join('\r\n') + '\r\n');
    return p;
  }
  const p = join(dir, 'mochi-standalone');
  writeFileSync(p, marker
    ? `#!/bin/sh\nprintf '%s\\n' "$@" > "${marker}"\nexit ${exitCode}\n`
    : `#!/bin/sh\nexit ${exitCode}\n`);
  chmodSync(p, 0o755);
  return p;
}

afterEach(() => {
  for (const k of PINNED) {
    const v = saved.get(k);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  saved.clear();
  while (tmpDirs.length) {
    try { rmSync(tmpDirs.pop()!, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
});

describe('engine identity', () => {
  it('vitest runs under node, so the current engine is node', () => {
    expect(currentEngine()).toBe('node');
  });

  it('reports bun only when the bun runtime is present', () => {
    const hasBun = Boolean((process.versions as Record<string, string | undefined>).bun);
    expect(currentEngine()).toBe(hasBun ? 'bun' : 'node');
  });
});

describe('candidate discovery', () => {
  it('honors an explicit standalone pin', () => {
    const p = tmpFile('mochi-standalone', '#!/bin/sh\nexit 0\n');
    pin('MOCHI_STANDALONE', p);
    expect(findStandalone()).toBe(p);
  });

  it('a missing pin is not silently replaced by discovery', () => {
    pin('MOCHI_STANDALONE', '/nonexistent/mochi-standalone');
    expect(findStandalone()).toBeNull();
  });

  it('honors an explicit node-entry pin', () => {
    const p = tmpFile('cli.js', 'console.log(1);\n');
    pin('MOCHI_NODE_ENTRY', p);
    expect(findNodeEntry()).toBe(p);
  });

  it('a missing node pin reports null instead of a dead path', () => {
    pin('MOCHI_NODE_ENTRY', '/nonexistent/cli.js');
    expect(findNodeEntry()).toBeNull();
  });
});

describe('handleEngineArg', () => {
  it('continues in-process when we are already on the requested engine', () => {
    expect(handleEngineArg('node', [])).toEqual({ continue: true, exitCode: null });
  });

  it('runs the pinned standalone binary and returns its exit code', () => {
    const bin = tmpExec(7);
    pin('MOCHI_STANDALONE', bin);
    const r = handleEngineArg('standalone', ['--version']);
    expect(r.continue).toBe(false);
    expect(r.exitCode).toBe(7);
  });

  it('fails loudly (127) instead of crashing when the pinned binary is missing', () => {
    pin('MOCHI_STANDALONE', '/nonexistent/mochi-standalone');
    const r = handleEngineArg('standalone', []);
    expect(r.continue).toBe(false);
    expect(r.exitCode).toBe(127);
  });

  it('propagates arguments verbatim to the spawned engine', () => {
    const marker = join(tmpdir(), `mochi-dispatch-marker-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const bin = tmpExec(0, marker);
    pin('MOCHI_STANDALONE', bin);
    const r = handleEngineArg('standalone', ['--quiet', 'a prompt with spaces']);
    expect(r.exitCode).toBe(0);
    const logged = readFileSync(marker, 'utf8').replace(/\r\n/g, '\n');
    expect(logged).toBe('--quiet\na prompt with spaces\n');
    try { rmSync(marker, { force: true }); } catch { /* best-effort */ }
  });
});

describe('runtime report', () => {
  it('describes the current engine, launcher, and entry', async () => {
    pin('MOCHI_NO_NATIVE', '1'); // never spawn the real mochi-agent in tests
    pin('MOCHI_LAUNCHER', undefined);
    pin('MOCHI_ACTIVE_ENGINE', undefined);
    const r = await runtimeReport('9.9.9');
    expect(r.version).toBe('9.9.9');
    expect(r.engine).toBe('node');
    expect(r.launcher).toBe('none');
    expect(r.entry).toContain('runtime-dispatch');
    expect(r.nativeCore.version).toBeNull(); // MOCHI_NO_NATIVE=1
    const text = formatRuntimeReport(r);
    expect(text).toContain('Mochi 9.9.9 — runtime');
    expect(text).toContain('mochi node:');
    expect(text).toContain('rust core:');
  });

  it('surfaces the rust launcher and the engine it selected', async () => {
    pin('MOCHI_NO_NATIVE', '1');
    pin('MOCHI_LAUNCHER', 'rust');
    pin('MOCHI_ACTIVE_ENGINE', 'standalone');
    const r = await runtimeReport('1.0.0');
    expect(r.launcher).toBe('rust');
    expect(r.selectedEngine).toBe('standalone');
    expect(formatRuntimeReport(r)).toContain('selected:    standalone');
  });

  it('fileAgeSecs is null for missing files and a number for real ones', () => {
    const p = tmpFile('aged', 'x');
    expect(fileAgeSecs(p)).toBeGreaterThanOrEqual(0);
    expect(fileAgeSecs('/nonexistent/aged')).toBeNull();
    expect(fileAgeSecs(null)).toBeNull();
  });
});
