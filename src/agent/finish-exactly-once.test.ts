// B2 regression: finish() had no exactly-once guard.
//
// When the token budget exhausts MID-BATCH, every tool call in the same
// parallel batch takes the budget-exhausted branch in runMoolCall
// (loop.ts ~4011-4036) and each calls finish() — N concurrent full teardowns:
// N duplicate agent:completed events, N summary:rendered emissions, N
// recordAgentEnd calls on the shared budget, and (for successful runs) N
// extra narrative model calls after the budget is already gone. When the
// batch finishes, the loop top then hits its own exhausted check and calls
// finish() AGAIN — a further duplicate teardown.
//
// Contract pinned here: within one agent run, finish() runs EXACTLY ONCE.
// A budget-exhausted parallel batch yields exactly one agent:completed and
// one summary:rendered event for the agent, regardless of batch size.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Agent } from './loop.js';
import { BudgetEngine } from '../budget.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI, type FakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig, MochiEvent } from '../types.js';

function makeConfig(dir: string, url: string): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: url, model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 40, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 8000, maxTokens: 1 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false,
    projectDir: '.mochi',
    configDir: resolve(dir, '.config/mochi'),
    quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
}

describe('exactly-once finish under a budget-exhausted parallel batch (B2)', () => {
  it('emits exactly one agent:completed / summary:rendered for the run', async () => {
    let fake: FakeOpenAI | undefined;
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-once-finish-'));
    try {
      writeFileSync(resolve(dir, 'a.ts'), 'export const a = 1;\n');
      writeFileSync(resolve(dir, 'b.ts'), 'export const b = 2;\n');
      // Turn 1: FOUR read-only tool calls in one batch (they run concurrently
      // via Promise.all in executeToolCalls). maxTokens: 1 exhausts the budget
      // during turn 1, so EVERY call in the batch sees phase() === 'exhausted'
      // and takes the in-tool finish branch — the audit's N-concurrent-finish
      // scenario.
      fake = await startFakeOpenAI([
        {
          content: 'Reading files.',
          completionTokens: 50, // blows the 1-token budget during turn 1
          toolCalls: [1, 2, 3, 4].map((k) => ({
            id: `t-${k}`, type: 'function',
            function: { name: 'read', arguments: JSON.stringify({ path: k % 2 === 0 ? 'a.ts' : 'b.ts' }) },
          })),
          finishReason: 'tool_calls',
        },
      ]);
      const config = makeConfig(dir, fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const events = new EventBus();
      let completed = 0;
      let rendered = 0;
      events.onAll((e: MochiEvent) => {
        if (e.type === 'agent:completed') completed += 1;
        // summary:rendered carries agentId — count only this agent's card
        // (the bus is session-scoped and other fixtures could share it).
        if (e.type === 'summary:rendered' && (e as { agentId?: string }).agentId === 'b2-once') rendered += 1;
      });
      const context = new ContextEngine(config, dir);
      context.setGoal('Read the files');
      const task = createTask('Read the files', 'Read a.ts and b.ts.', {
        acceptanceCriteria: [],
      } as never);
      const agent = new Agent({ id: 'b2-once', role: 'coder', config, workspace, events, cwd: dir, context, budget: new BudgetEngine({ maxRuntimeMinutes: 5, maxTokens: 1, maxConcurrentAgents: 1 } as never) } as never);
      const result = await agent.run(task);
      // The run must actually end (no hang from a guard that swallows the
      // loop-top finish), with the budget stop reason.
      expect(String(result.stopReason)).toBe('budget');
      // With the bug: 5 finishes (4 concurrent in-batch + 1 loop-top) → 5
      // agent:completed events. Exactly-once: 1.
      expect(completed).toBe(1);
      expect(rendered).toBe(1);
    } finally {
      await fake?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
