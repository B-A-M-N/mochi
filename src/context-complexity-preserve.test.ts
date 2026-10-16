import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContextEngine } from './context.js';
import type { MochiConfig } from './types.js';

// Complex tasks must retain working memory (file bodies / tool output) instead
// of having it folded and truncated mid-run; simple/standard tasks keep the
// original aggressive/lean constants exactly.

let isolatedSkillsDir: string;
beforeAll(() => { isolatedSkillsDir = mkdtempSync(join(tmpdir(), 'mochi-ctx-cx-')); });
afterAll(() => { rmSync(isolatedSkillsDir, { recursive: true, force: true }); });

function cfg(): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: 'http://127.0.0.1:1/v1', model: 'fake-model' },
    safety: { contextBudgetTokens: 100000, maxIterations: 50, maxRuntimeMinutes: 10, mode: 'safe' as const },
  } as MochiConfig;
}

function makeEngine(dir: string): ContextEngine {
  return new ContextEngine(cfg(), dir, isolatedSkillsDir);
}

describe('ContextEngine complex-task context preservation', () => {
  it('keeps a large ingested tool result intact for complex tasks (folds for simple)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-ctx-cx-'));
    const long = Array.from({ length: 200 }, (_, i) => `const value_${i} = compute_${i}(${i}); // pad pad pad pad pad`).join('\n');
    expect(long).toContain('value_100');

    const simple = makeEngine(dir);
    simple.addMessage({ role: 'tool', tool_call_id: 'c1', name: 'read', content: long });
    const simpleMsg = simple.getMessages()[0].content as string;
    expect(simpleMsg).toContain('output folded');
    expect(simpleMsg).not.toContain('value_100');

    const complex = makeEngine(dir);
    complex.setTaskComplexity('complex');
    complex.addMessage({ role: 'tool', tool_call_id: 'c1', name: 'read', content: long });
    const complexMsg = complex.getMessages()[0].content as string;
    expect(complexMsg).not.toContain('output folded');
    expect(complexMsg).toContain('value_100');
  });

  it('protects recent-enough file content from in-place shrinking on complex tasks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-ctx-cx-'));
    const body = 'Q'.repeat(5000);

    const simple = makeEngine(dir);
    simple.addMessage({ role: 'user', content: 'go' });
    simple.addMessage({ role: 'tool', tool_call_id: 'c1', name: 'read', content: body });
    for (let i = 0; i < 14; i++) simple.addMessage({ role: 'assistant', content: `step ${i}` });
    expect(simple.shrinkOldToolOutputs()).toBeGreaterThan(0);
    const simpleTool = simple.getMessages()[1].content as string;
    expect(simpleTool.length).toBeLessThan(600);
    expect(simpleTool).toContain('truncated in place');

    const complex = makeEngine(dir);
    complex.setTaskComplexity('complex');
    complex.addMessage({ role: 'user', content: 'go' });
    complex.addMessage({ role: 'tool', tool_call_id: 'c1', name: 'read', content: body });
    for (let i = 0; i < 14; i++) complex.addMessage({ role: 'assistant', content: `step ${i}` });
    expect(complex.shrinkOldToolOutputs()).toBe(0);
    expect(complex.getMessages()[1].content).toBe(body);
  });

  it('retains a deeper recency window through compaction on complex tasks', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-ctx-cx-'));

    const simple = makeEngine(dir);
    for (let i = 0; i < 50; i++) simple.addMessage({ role: 'user', content: `msg ${i}` });
    await simple.compact();
    expect(simple.messageCount).toBeLessThanOrEqual(14);

    const complex = makeEngine(dir);
    complex.setTaskComplexity('complex');
    for (let i = 0; i < 30; i++) complex.addMessage({ role: 'user', content: `msg ${i}` });
    await complex.compact();
    expect(complex.messageCount).toBeGreaterThanOrEqual(16);
  });

  it('resets to lean defaults when a later task is not complex', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-ctx-cx-'));
    const engine = makeEngine(dir);
    engine.setTaskComplexity('complex');
    expect(engine.preservingContext).toBe(true);
    engine.setTaskComplexity('simple');
    expect(engine.preservingContext).toBe(false);
  });
});
