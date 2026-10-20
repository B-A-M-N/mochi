// B23 regression: MOCHI_MEMORY_FILE with a missing parent directory crashed.
//
// ensure() created the DEFAULT ~/.mochi directory but then wrote the memory
// file at its OWN path — when MOCHI_MEMORY_FILE pointed at e.g.
// <tmp>/does-not-exist/memory.jsonl, writeFileSync threw ENOENT: the parent
// of the memory file was never created. Every memory write path (addFact,
// recordOutcome, prune) funnels through ensure(), so all of them crashed.
//
// Contract pinned here: the memory file's parent directory is created on
// demand, wherever MOCHI_MEMORY_FILE points.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { addFact, loadFacts } from './memory-store.js';

describe('MOCHI_MEMORY_FILE parent dir creation (B23)', () => {
  it('addFact works when the memory file parent does not exist yet', () => {
    const base = mkdtempSync(join(tmpdir(), 'mochi-b23-'));
    const nested = resolve(base, 'deep', 'nested', 'memory.jsonl');
    const saved = process.env.MOCHI_MEMORY_FILE;
    try {
      process.env.MOCHI_MEMORY_FILE = nested;
      const fact = addFact('B23 canary fact for parent-dir creation', 'fact', 'session');
      expect(fact).not.toBeNull();
      expect(existsSync(nested)).toBe(true);
      expect(loadFacts().some((f) => f.statement.includes('B23 canary fact'))).toBe(true);
    } finally {
      if (saved === undefined) delete process.env.MOCHI_MEMORY_FILE; else process.env.MOCHI_MEMORY_FILE = saved;
      rmSync(base, { recursive: true, force: true });
    }
  });
});
