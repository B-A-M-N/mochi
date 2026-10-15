// `mochi watch` core: change detection, debounce, check execution, stop.
import { describe, it, expect } from 'vitest';
import { loadWatchConfig, watchCheckCommand, runWatch, type WatchConfig } from './watch.js';

describe('watch config', () => {
  it('prefers test > typecheck > build', () => {
    expect(watchCheckCommand({ testCommand: 'npm test', typecheckCommand: 'tsc', buildCommand: 'make' } as WatchConfig)).toBe('npm test');
    expect(watchCheckCommand({ testCommand: null, typecheckCommand: 'tsc', buildCommand: 'make' } as WatchConfig)).toBe('tsc');
    expect(watchCheckCommand({ testCommand: null, typecheckCommand: null, buildCommand: 'make' } as WatchConfig)).toBe('make');
    expect(watchCheckCommand({ testCommand: null, typecheckCommand: null, buildCommand: null } as WatchConfig)).toBeNull();
  });

  it('loads config with detected test command', () => {
    const c = loadWatchConfig('/tmp');
    expect(Array.isArray(c.paths)).toBe(true);
  });
});

describe('runWatch', () => {
  it('no check command → zero runs, no crash', async () => {
    const s = await runWatch({ paths: [], testCommand: null, buildCommand: null, typecheckCommand: null }, {});
    expect(s.runs).toBe(0);
  });

  it('stops on abort without running', async () => {
    const ctl = new AbortController();
    ctl.abort();
    let runs = 0;
    const s = await runWatch(
      { paths: [], testCommand: 'npm test', buildCommand: null, typecheckCommand: null },
      { signal: ctl.signal, sleepMs: (ms) => new Promise((r) => setTimeout(r, ms)), runCheck: async () => { runs++; return { ok: true, exitCode: 0, output: '' }; } },
    );
    expect(s.runs).toBe(0);
    expect(runs).toBe(0);
    expect(s.stopped).toBe(true);
  });

  it('runs the check once per detected change and reports pass/fail', async () => {
    let statCalls = 0;
    let checkCount = 0;
    const logs: string[] = [];
    const s = await runWatch(
      { paths: ['f.ts'], testCommand: 'npm test', buildCommand: null, typecheckCommand: null },
      {
        stat: (p) => {
          if (p !== 'f.ts') return null;
          statCalls++;
          // Path expansion + baseline fingerprint both see 1000; the first
          // real poll sees 2000: exactly one change.
          return { mtimeMs: statCalls <= 2 ? 1000 : 2000, size: 1 };
        },
        listFiles: () => ['f.ts'],
        sleepMs: async () => {},
        runCheck: async () => { checkCount++; return { ok: true, exitCode: 0, output: 'PASS' }; },
        onLog: (l) => logs.push(l),
        maxRuns: 1,
        maxPolls: 5,
      },
    );
    expect(s.runs).toBe(1);
    expect(checkCount).toBe(1);
    expect(logs.some((l) => l.includes('PASS'))).toBe(true);
  });

  it('debounces a burst into a single check', async () => {
    let mtime = 1000;
    let statCalls = 0;
    let checkCount = 0;
    const s = await runWatch(
      { paths: ['f.ts'], testCommand: 'npm test', buildCommand: null, typecheckCommand: null },
      {
        stat: (p) => {
          if (p !== 'f.ts') return null;
          statCalls++;
          mtime += 1000; // every poll sees a fresh change: a save burst
          return { mtimeMs: mtime, size: 1 };
        },
        listFiles: () => ['f.ts'],
        sleepMs: async () => {},
        runCheck: async () => { checkCount++; return { ok: true, exitCode: 0, output: 'PASS' }; },
        // The whole burst falls inside one window, so it collapses to one check.
        debounceMs: 60_000,
        maxRuns: 10,
        maxPolls: 10,
      },
    );
    expect(s.runs).toBe(1);
    expect(checkCount).toBe(1);
    expect(statCalls).toBeGreaterThan(2);
  });
});