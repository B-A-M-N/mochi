// Regression: memory.jsonl rewrites used bare writeFileSync (loadFacts prune,
// recordFactAttempt, forgetFact, decayFacts) while every sibling store uses
// tmp+rename atomic writes. A crash, SIGKILL, OOM, or power loss mid-rewrite
// tore the entire durable-fact store — total memory loss, not one lost line.
//
// The fix routes all full-file rewrites through core/atomic-fs.ts
// (atomicWriteFileSync, the established repo pattern). Red→green proof: with
// the bug, rewrite paths never call atomicWriteFileSync; with the fix, every
// full-file rewrite goes through it. The mock wraps the REAL implementation so
// file behavior stays authentic.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpFile = join(mkdtempSync(join(tmpdir(), 'mochi-mem-atomic-')), 'memory.jsonl');
process.env['MOCHI_MEMORY_FILE'] = tmpFile;

const atomic = await import('../core/atomic-fs.js');
// Capture the ORIGINAL implementation before spying (the spy replaces the
// export binding; capturing after would recurse into itself).
const realAtomic = atomic.atomicWriteFileSync;
const atomicSpy = vi.spyOn(atomic, 'atomicWriteFileSync');
atomicSpy.mockImplementation((p, c) => realAtomic(p, c));

const store = await import('./memory-store.js');
const { addFact, recordFactAttempt, forgetFact, decayFacts, loadFacts } = store;

beforeEach(() => {
  try { rmSync(tmpFile, { force: true }); } catch { /* fresh */ }
  atomicSpy.mockClear();
});
afterEach(() => { try { rmSync(tmpFile, { force: true }); } catch { /* tmp */ } });

function tmpDebris(): string[] {
  return readdirSync(join(tmpFile, '..')).filter((f) => f.endsWith('.tmp'));
}

describe('memory.jsonl atomic rewrites (B7)', () => {
  it('prune rewrite (loadFacts) goes through atomicWriteFileSync and stays intact', () => {
    const a = addFact('The parser handles nested arrays by recursing with depth tracking', 'fact', 'session');
    addFact('Build outputs land in dist and the bundle is dist/mochi-bin', 'fact', 'session');
    expect(loadFacts().length).toBe(2);
    atomicSpy.mockClear(); // addFact is an append; only REWRITES are pinned here

    recordFactAttempt(a!.id, false);
    recordFactAttempt(a!.id, false);
    recordFactAttempt(a!.id, false);
    // a is now MAX_FAILS dead → loadFacts prunes via a full-file rewrite.
    const after = loadFacts();
    expect(after.length).toBe(1);
    expect(atomicSpy).toHaveBeenCalled();
    const raw = readFileSync(tmpFile, 'utf8');
    for (const line of raw.split('\n').filter((l) => l.trim())) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
    expect(tmpDebris()).toEqual([]);
  });

  it('recordFactAttempt and forgetFact rewrites go through atomicWriteFileSync', () => {
    const a = addFact('User prefers concise responses with no preamble', 'preference', 'user');
    atomicSpy.mockClear();

    recordFactAttempt(a!.id, true);
    expect(atomicSpy).toHaveBeenCalled();

    atomicSpy.mockClear();
    const removed = forgetFact('preamble');
    expect(removed).toBe(1);
    expect(atomicSpy).toHaveBeenCalled();
    expect(tmpDebris()).toEqual([]);
  });

  it('decayFacts rewrite goes through atomicWriteFileSync', () => {
    const a = addFact('Ancient fact about zebra migrations for decay', 'fact', 'session');
    atomicSpy.mockClear();

    // Backdate past the 60-day decay horizon AND mark it tried-but-never-
    // succeeded (attempts===0 facts are exempt from decay by design).
    const facts = loadFacts().map((f) => (f.id === a!.id ? { ...f, ts: Date.now() - 61 * 24 * 3600 * 1000, attempts: 2 } : f));
    writeFileSync(tmpFile, facts.map((f) => JSON.stringify(f)).join('\n') + '\n');

    const pruned = decayFacts();
    expect(pruned).toBe(1);
    expect(atomicSpy).toHaveBeenCalled();
    expect(tmpDebris()).toEqual([]);
    // Restore the pass-through mock for other tests.
    atomicSpy.mockImplementation((p, c) => realAtomic(p, c));
  });
});
