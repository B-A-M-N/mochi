// B22 regression: the background-task ledger bled across working directories.
//
// persist() wrote the ENTIRE in-memory registry to `lastStateDir` — the cwd
// of the MOST RECENTLY STARTED task. Start a task in workspace A, then one
// in workspace B, and every subsequent persist (flush, exit, kill) dumped
// BOTH tasks into B's ledger, while A's ledger kept its stale 'running'
// record — which listPersistedTasks then "corrected" to 'failed (owner
// process exited before completion)' even though the task had completed
// fine in-process.
//
// Contract pinned here: a task's ledger record lives in — and only in — the
// ledger of the directory it was started in, and its completion status is
// recorded there.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startBackgroundTask, getTask, listPersistedTasks, type BackgroundTask } from './background-tasks.js';

const LEDGER = join('.mochi', 'bg-tasks.json');

function ledgerIds(dir: string): string[] {
  const file = join(dir, LEDGER);
  if (!existsSync(file)) return [];
  return (JSON.parse(readFileSync(file, 'utf8')) as BackgroundTask[]).map((t) => t.id);
}

async function waitStatus(id: string, want: BackgroundTask['status'], timeoutMs = 8000): Promise<BackgroundTask> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const t = getTask(id);
    if (t && t.status === want) return t;
    if (Date.now() > deadline) throw new Error(`task ${id} never reached ${want} (got ${t?.status ?? 'gone'})`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe('background-task ledger stays in its own cwd (B22)', () => {
  it('completion lands in the owning dir and never bleeds into another', async () => {
    const dirA = mkdtempSync(join(tmpdir(), 'mochi-b22-a-'));
    const dirB = mkdtempSync(join(tmpdir(), 'mochi-b22-b-'));
    try {
      // t1 runs long enough that t2's start+exit happen while lastStateDir
      // has already moved to B.
      const t1 = startBackgroundTask('sleep 0.5', dirA, { description: 'workspace A task' });
      const t2 = startBackgroundTask('true', dirB, { description: 'workspace B task' });
      await waitStatus(t2.id, 'completed');
      await waitStatus(t1.id, 'completed');

      // No bleed: B's ledger holds ONLY B's task.
      expect(ledgerIds(dirB)).toEqual([t2.id]);
      // A's ledger holds A's task, COMPLETED (not the stale 'running' that
      // the old code left there — which listPersistedTasks then falsified
      // into 'failed (owner process exited before completion)').
      expect(ledgerIds(dirA)).toEqual([t1.id]);
      const persisted = listPersistedTasks(dirA).find((t) => t.id === t1.id);
      expect(persisted?.status).toBe('completed');
      expect(persisted?.output).not.toContain('owner process exited');
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  }, 20_000);
});
