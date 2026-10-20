// B28: bg-tasks.json was written with a bare writeFileSync, so a crash
// mid-write (SIGKILL/OOM during the write — a window the 1s running-task
// flush widens) tears the ledger: a fresh `mochi bg list|logs|kill` process
// then dies on truncated JSON. The write now goes through
// atomicWriteFileSync (tmp+rename, same as PRs #25/#34).
//
// The test simulates the crash deterministically: it seeds a ledger with a
// dead-pid running entry (so listPersistedTasks' stale-correction write-back
// fires — the real production write path), then wraps fs.writeFileSync so a
// write aimed AT THE LEDGER lands half the payload and throws (the "crash").
// Red on the bare write: the ledger itself is torn. Green on the atomic
// helper: the tear lands in the hidden sibling tmp file and the rename
// completes atomically.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const crashState = vi.hoisted(() => ({ ledgerPath: null as string | null }));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    writeFileSync: (file: Parameters<typeof actual.writeFileSync>[0], data: Parameters<typeof actual.writeFileSync>[1]) => {
      const s = typeof data === 'string' ? data : Buffer.from(data as ArrayBufferLike & ArrayBufferView).toString('utf8');
      if (crashState.ledgerPath && String(file) === crashState.ledgerPath) {
        // Crash mid-write: half the bytes land, then the process "dies".
        actual.writeFileSync(file, s.slice(0, Math.floor(s.length / 2)));
        throw new Error('ECRASH: simulated SIGKILL mid-write');
      }
      return actual.writeFileSync(file, data);
    },
  };
});

describe('bg-tasks.json ledger write is atomic (B28)', () => {
  afterEach(() => {
    crashState.ledgerPath = null;
  });

  it('a crash mid-write leaves a parseable ledger, not a torn file', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-b28-'));
    const ledger = resolve(dir, '.mochi', 'bg-tasks.json');
    mkdirSync(resolve(dir, '.mochi'), { recursive: true });
    // Dead pid → listPersistedTasks corrects the stale 'running' record and
    // writes the ledger back (the production write path under test).
    const deadPid = spawnSync('true').pid ?? 999999;
    const full = JSON.stringify([{
      id: 'b28torn01',
      command: 'cat /etc/big-file',
      startedAt: Date.now(),
      status: 'running',
      output: 'x'.repeat(40_000),
      pid: deadPid,
    }]);
    // Seed with the REAL writeFileSync (the mock only tears when armed).
    const { writeFileSync: seedWrite } = await import('node:fs') as typeof import('node:fs');
    seedWrite(ledger, full);

    crashState.ledgerPath = ledger;

    const { listPersistedTasks } = await import('./background-tasks.js');
    // The write-back crash is caught inside writeLedger (best-effort) — the
    // call itself must not throw either way.
    const list = listPersistedTasks(dir);
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('failed'); // correction happened in memory

    // The ledger on disk must be parseable JSON — the whole old file or the
    // whole new one, never torn. RED on bare writeFileSync: half the bytes
    // landed in the ledger itself → JSON.parse throws right here.
    const raw = readFileSync(ledger, 'utf8');
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    const record = parsed.find((t) => t.id === 'b28torn01') as { output?: string; status?: string } | undefined;
    expect(record).toBeDefined();
    // The corrected WHOLE version survived the atomic rename: full 40k output
    // plus the stale-correction suffix, status failed. (A torn prefix would
    // have already died in the JSON.parse above.)
    expect(record!.status).toBe('failed');
    expect(record!.output!.startsWith('x'.repeat(1_000))).toBe(true);
    expect(record!.output!.length).toBeGreaterThanOrEqual(40_000);
    // No hidden tmp siblings left behind on the atomic path.
    const leftovers = readdirSync(resolve(dir, '.mochi')).filter((f) => f.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('a healthy write still round-trips through the atomic path', async () => {
    const { startBackgroundTask } = await import('./background-tasks.js');
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-b28ok-'));
    const t = startBackgroundTask('echo b28-roundtrip', dir);
    for (let i = 0; i < 50 && t.status === 'running'; i++) await new Promise((r) => setTimeout(r, 100));
    const ledger = resolve(dir, '.mochi', 'bg-tasks.json');
    const parsed = JSON.parse(readFileSync(ledger, 'utf8')) as Array<{ id: string; output: string }>;
    expect(parsed.some((x) => x.id === t.id && x.output.includes('b28-roundtrip'))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
