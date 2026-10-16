import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { MemoryStore } from './memory.js';

describe('MemoryStore', () => {
  it('curates durable engineering memory', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-memory-'));
    const store = new MemoryStore(dir);
    expect(store.addDecision('Use Zustand', 'State management uses Zustand instead of Redux.', 'commit 82af31')).toBe(true);
    expect(store.addDecision('Use Zustand', 'Duplicate entry should be ignored.')).toBe(false);
    const content = readFileSync(resolve(dir, 'memory/decisions.md'), 'utf8');
    expect(content).toContain('## decision: Use Zustand');
    expect(content).not.toContain('Duplicate entry');
    expect(store.summary()).toContain('Use Zustand');
  });

  it('separates memory categories', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-memory-'));
    const store = new MemoryStore(dir);
    store.addArchitecture('Monorepo', 'pnpm workspaces');
    store.addConvention('REST naming', 'API routes use plural nouns.');
    const summary = store.load();
    expect(summary).toContain('architectures');
    expect(summary).toContain('conventions');
  });

  it('preserves the stored timestamp (no phantom 1970 dates)', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-memory-'));
    const store = new MemoryStore(dir);
    const when = Date.parse('2026-08-20T05:08:05.444Z');
    store.add({ kind: 'architecture', title: 'Layered', body: 'runtime owns goals', updatedAt: when });
    const [entry] = store.entries('architecture');
    expect(entry.updatedAt).toBe(when);
    expect(store.load()).not.toContain('1970-01-01');
    expect(store.load()).toContain('2026-08-20');
  });

  it('caps failure memory so it cannot grow without bound', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-memory-'));
    const store = new MemoryStore(dir);
    const cap = MemoryStore.MAX_FAILURE_ENTRIES;
    for (let i = 0; i < cap + 5; i++) store.addFailure(`Failed: task-${i}`, `reason ${i}`);
    const kept = store.entries('failure');
    expect(kept).toHaveLength(cap);
    // Newest retained, oldest dropped.
    expect(kept[kept.length - 1].title).toContain(`task-${cap + 4}`);
    expect(kept.some((e) => e.title.includes('task-0'))).toBe(false);
  });

  it('removes failure lessons once a later successful run proves them resolved', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-memory-'));
    const store = new MemoryStore(dir);
    expect(store.addFailure('Failed: flaky task', 'exit code 1')).toBe(true);
    expect(store.entries('failure').map((e) => e.title)).toContain('failure: Failed: flaky task');
    expect(store.removeFailure('flaky task')).toBe(true);
    expect(store.removeFailure('flaky task')).toBe(false);
    expect(store.entries('failure')).toHaveLength(0);
  });
});
