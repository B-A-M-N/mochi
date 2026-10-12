import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { UsageStore } from './usage.js';

describe('UsageStore', () => {
  it('records and aggregates usage', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-usage-'));
    const store = new UsageStore(dir);
    // Simulate provider-reported billing (costUsd passed explicitly)
    store.record('gpt-4o', 'fix auth', { tokensOut: 3000, tokensIn: 500, costUsd: 0.0042, modelCalls: 2, toolCalls: 4, durationMs: 5000 });
    store.record('gpt-4o', 'add tests', { tokensOut: 1000, tokensIn: 200, costUsd: 0.0018, modelCalls: 1, toolCalls: 2, durationMs: 3000 });

    const total = store.total();
    expect(total.modelCalls).toBe(3);
    expect(total.toolCalls).toBe(6);
    expect(total.tokensOut).toBe(4000);
    expect(total.tokensIn).toBe(700);
    expect(total.durationMs).toBe(8000);
    expect(total.costUsd).toBeCloseTo(0.006);
    expect(store.summary()).toContain('provider-reported');
    expect(store.recent()).toContain('fix auth');
  });

  it('persists across instances', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-usage-'));
    const a = new UsageStore(dir);
    a.record('models/fake-model', 'task one', { tokensOut: 10, modelCalls: 1 });
    const b = new UsageStore(dir);
    expect(b.total().modelCalls).toBe(1);
    // No provider cost reported → 0
    expect(b.total().costUsd).toBe(0);
  });
});