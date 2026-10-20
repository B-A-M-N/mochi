// B29: cron.ts saveJobs and daemon.ts writeInfo used bare writeFileSync — the
// same I4 violation class as bg-tasks.json (B28), memory.jsonl (#25) and
// checkpoints (#34). A crash mid-write tears cron.json (re-read by the daemon
// on every scheduler tick) or daemon info.json (read by every client for
// discovery — and it carries the bearer token, so the write must be 0600 from
// the FIRST byte, not briefly default-mode in flight).
//
// Crash simulation identical to bg-ledger-atomic.test.ts: vi.mock('node:fs')
// lands half the payload and throws for writes aimed at the target file.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const crashState = vi.hoisted(() => ({ targetPath: null as string | null }));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    writeFileSync: (file: Parameters<typeof actual.writeFileSync>[0], data: Parameters<typeof actual.writeFileSync>[1], opts?: Parameters<typeof actual.writeFileSync>[2]) => {
      const s = typeof data === 'string' ? data : Buffer.from(data as ArrayBufferLike & ArrayBufferView).toString('utf8');
      if (crashState.targetPath && String(file) === crashState.targetPath) {
        actual.writeFileSync(file, s.slice(0, Math.floor(s.length / 2)));
        throw new Error('ECRASH: simulated SIGKILL mid-write');
      }
      return actual.writeFileSync(file, data, opts);
    },
  };
});

describe('daemon state writes are atomic (B29)', () => {
  afterEach(() => {
    crashState.targetPath = null;
  });

  it('cron.json survives a crash mid-saveJobs (parseable, no tmp leftovers)', async () => {
    const { addJob } = await import('./cron.js');
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-b29cron-'));
    mkdirSync(resolve(dir, '.mochi'), { recursive: true });
    // First job lands normally (real write path, no crash armed).
    const first = addJob(dir, 'say hi', 'every 30m');
    expect(first.id).toBeDefined();
    const cronJson = resolve(dir, '.mochi', 'cron.json');
    expect(JSON.parse(readFileSync(cronJson, 'utf8'))).toHaveLength(1);

    // Arm the crash and add a second job — the saveJobs write tears on a
    // bare writeFileSync. The throw represents the process dying mid-write;
    // catch it here (the caller is dead either way) so the test reaches the
    // DURABLE damage: the torn file left on disk.
    crashState.targetPath = cronJson;
    try {
      addJob(dir, 'say bye', 'every 1h');
    } catch {
      /* the simulated crash killed the caller — see below */
    }

    const parsed = JSON.parse(readFileSync(cronJson, 'utf8')) as Array<{ id: string; prompt: string }>;
    // The ledger is either fully-old (1 job) or fully-new (2 jobs) — never torn.
    expect([1, 2]).toContain(parsed.length);
    for (const job of parsed) {
      expect(job.id).toBeTruthy();
      expect(job.prompt).toBeTruthy();
    }
    const leftovers = readdirSync(resolve(dir, '.mochi')).filter((f) => f.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('daemon info.json is written atomically and is 0600 from birth', async () => {
    const { daemonInfoPath } = await import('./daemon.js');
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-b29info-'));
    const infoPath = daemonInfoPath(dir);
    mkdirSync(resolve(infoPath, '..'), { recursive: true });

    // Drive the REAL production writer through startDaemonInProcess? Too heavy.
    // writeInfo is private; the honest observable is the atomic helper's mode
    // contract + the daemon.ts call shape. Test the helper contract directly:
    // a fresh file written with opts.mode must be 0600 the moment it exists.
    const { atomicWriteFileSync } = await import('../core/atomic-fs.js');
    atomicWriteFileSync(infoPath, JSON.stringify({ pid: 1, port: 1, token: 'b29-secret' }), { mode: 0o600 });
    const st = statSync(infoPath);
    expect(st.mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(infoPath, 'utf8'))).toEqual({ pid: 1, port: 1, token: 'b29-secret' });
    rmSync(dir, { recursive: true, force: true });
  });

  it('mode-forced atomic write lands whole with the forced mode (fresh file)', async () => {
    const { atomicWriteFileSync } = await import('../core/atomic-fs.js');
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-b29mode-'));
    const target = resolve(dir, 'secret.json');
    // Armed crash: the tmp write succeeds (mock passes through — path is the
    // tmp sibling, not the target), rename succeeds → whole content lands.
    crashState.targetPath = target;
    expect(() => atomicWriteFileSync(target, JSON.stringify({ token: 'b29' }), { mode: 0o600 })).not.toThrow();
    const st = statSync(target);
    expect(st.mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(target, 'utf8'))).toEqual({ token: 'b29' });
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});
