// `mochi watch` — the tightest coding feedback loop: watch files, and on every
// change run the repo's test/build/typecheck command and report pass/fail.
// Transport (fs polling, command execution, sleeping) is injected so the core
// is unit-testable without a filesystem or a real test runner.
//
// Why polling and not fs.watch: the loop must be portable (CI sandboxes, Windows,
// containers where inotify is unreliable), must debounce bursts (an editor
// save + a formatter pass = one check, not three), and must never miss a change.
// A 400ms mtime poll satisfies all three and is imperceptible.

import { statSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectRepo } from './repo/repo.js';

export interface WatchConfig {
  paths: string[];        // directories or files to watch
  testCommand: string | null;
  buildCommand: string | null;
  typecheckCommand: string | null;
}

export interface WatchStat {
  mtimeMs: number;
  size: number;
  /** Real fs.Stats carries this as a method; injected test stats use a boolean or omit it (file). */
  isDirectory?: boolean | (() => boolean);
}

export interface WatchDeps {
  /** Fingerprint per watched path (null when absent). Stat injected for tests. */
  stat?: (p: string) => WatchStat | null;
  /** Run a check command, resolve {ok, exitCode, output}. */
  runCheck?: (cmd: string, timeoutMs: number) => Promise<{ ok: boolean; exitCode: number; output: string }>;
  sleepMs?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Recursive file listing under a dir (injected for tests). */
  listFiles?: (dir: string) => string[];
  maxRuns?: number;
  /** Safety cap on polls (tests + runaway guard). Defaults to unbounded. */
  maxPolls?: number;
  /** Debounce window: changes within one window collapse into one check. */
  debounceMs?: number;
  pollMs?: number;
  onLog?: (line: string) => void;
  signal?: AbortSignal;
}

export interface WatchSummary { runs: number; passed: number; failed: number; stopped: boolean }

/** Resolve what to watch + which check command to run. Pure. */
export function loadWatchConfig(cwd: string): WatchConfig {
  const repo = detectRepo(cwd);
  return {
    paths: [cwd],
    testCommand: repo.testCommand ?? null,
    buildCommand: repo.buildCommand ?? null,
    typecheckCommand: repo.typecheckCommand ?? null,
  };
}

/** Pick the best check command for watch mode: test > typecheck > build. */
export function watchCheckCommand(cfg: WatchConfig): string | null {
  return cfg.testCommand ?? cfg.typecheckCommand ?? cfg.buildCommand;
}

function allFilesUnder(dir: string, listFiles: (d: string) => string[]): string[] {
  const out: string[] = [];
  for (const entry of listFiles(dir)) {
    const full = resolve(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      out.push(...allFilesUnder(full, listFiles));
    } else {
      out.push(full);
    }
  }
  return out;
}

function fingerprintAll(paths: string[], stat: (p: string) => WatchStat | null): string {
  const parts: string[] = [];
  for (const p of paths) {
    const st = stat(p);
    parts.push(st ? `${p}:${st.mtimeMs}:${st.size}` : `${p}:-`);
  }
  return parts.join('|');
}

/** Watch loop: poll → debounce → check → report. Stops on abort, stop(), or maxRuns. */
export async function runWatch(cfg: WatchConfig, deps: WatchDeps): Promise<WatchSummary> {
  const stat = deps.stat ?? ((p: string) => { try { return statSync(p); } catch { return null; } });
  const listFiles = deps.listFiles ?? ((d: string) => { try { return readdirSync(d); } catch { return []; } });
  const sleepMs = deps.sleepMs ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const runCheck = deps.runCheck ?? (async () => ({ ok: false, exitCode: -1, output: 'no runner' }));
  const log = deps.onLog ?? (() => {});
  const maxRuns = deps.maxRuns ?? Number.MAX_SAFE_INTEGER;
  const pollMs = deps.pollMs ?? 400;
  const debounceMs = deps.debounceMs ?? 600;
  const cmd = watchCheckCommand(cfg);
  if (!cmd) {
    log('watch: no test/build/typecheck command detected — nothing to run on change.');
    return { runs: 0, passed: 0, failed: 0, stopped: false };
  }

  // Expand watched directories into the file set we fingerprint. The default
  // stat returns real fs.Stats (isDirectory is a method); injected test stats
  // are plain {mtimeMs, size} objects (no isDirectory → treated as files).
  const files: string[] = [];
  for (const p of cfg.paths) {
    const st = stat(p);
    const flag = st?.isDirectory;
    const stDir = typeof flag === 'function' ? flag.call(st) : Boolean(flag);
    if (st && stDir) files.push(...allFilesUnder(p, listFiles));
    else files.push(p);
  }
  let fp = fingerprintAll(files, stat);

  let runs = 0, passed = 0, failed = 0;
  let lastChange = 0;
  let polls = 0;
  const maxPolls = deps.maxPolls ?? Number.MAX_SAFE_INTEGER;

  while (runs < maxRuns && polls < maxPolls) {
    polls++;
    if (deps.signal?.aborted) break;
    await sleepMs(pollMs);
    if (deps.signal?.aborted) break;

    const next = fingerprintAll(files, stat);
    if (next !== fp) {
      // Debounce: a burst of saves/formats should trigger exactly one check.
      const now = Date.now();
      if (now - lastChange < debounceMs) continue;
      lastChange = now;
      fp = next;
      runs++;
      log(`watch: change detected → running \`${cmd}\` (run ${runs})`);
      try {
        const r = await runCheck(cmd, 120_000);
        const tail = r.output.split('\n').filter(Boolean).slice(-6).join('\n');
        if (r.ok) {
          passed++;
          log(`watch: PASS (run ${runs})`);
        } else {
          failed++;
          log(`watch: FAIL (run ${runs}, exit ${r.exitCode})\n${tail}`);
        }
      } catch (e) {
        failed++;
        log(`watch: check error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return { runs, passed, failed, stopped: deps.signal?.aborted ?? false };
}
