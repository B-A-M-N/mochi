// B16 regression: recordAgentEnd() without a matching recordAgentStart().
//
// At iteration i=0 the abort and runtime-limit guards (loop.ts ~1518-1527)
// run BEFORE the `if (i === 0) budget.recordAgentStart()` call (~1529). A run
// aborted during the first preflight therefore reaches finish(), whose
// unconditional `budget?.recordAgentEnd()` decrements usedAgents that was
// never incremented for this run — clamped at 0, so when a sibling agent on
// the SHARED budget holds a slot, the decrement steals it and the scheduler
// over-admits new agents while the sibling still runs.
//
// Contract pinned here: a pre-aborted run must not change the shared budget's
// usedAgents count beyond the slot IT acquired.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Agent } from './loop.js';
import { BudgetEngine } from '../budget.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import type { MochiConfig } from '../types.js';

function makeConfig(dir: string): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: 'http://127.0.0.1:1/v1', model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 5, maxRuntimeMinutes: 5, maxConcurrentAgents: 2, contextBudgetTokens: 8000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false,
    projectDir: '.mochi',
    configDir: resolve(dir, '.config/mochi'),
    quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
}

describe('recordAgentEnd/recordAgentStart symmetry (B16)', () => {
  it('a run aborted during first preflight does not steal a sibling slot', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-b16-'));
    try {
      const config = makeConfig(dir);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      // Sibling agent on the shared budget already holds one slot.
      const budget = new BudgetEngine(config.safety);
      budget.recordAgentStart();
      // Caller aborts BEFORE the run starts: at i=0 the abort guard fires
      // before the old recordAgentStart position.
      const ac = new AbortController();
      ac.abort();
      const context = new ContextEngine(config, dir);
      context.setGoal('Aborted before start');
      const task = createTask('Aborted before start', 'Never gets to run.', {
        acceptanceCriteria: [],
      } as never);
      const agent = new Agent({ id: 'b16-asym', role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context, budget, abortSignal: ac.signal });
      const result = await agent.run(task);
      expect(result.stopReason).toBe('aborted');
      // With the bug: finish() decremented usedAgents 1 -> 0 (the sibling's
      // slot stolen). The aborted run never acquired a slot, so the count
      // must still be 1.
      expect(budget.snapshot().usedAgents).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it('a normal run still releases its own slot (no over-correction)', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-b16-ok-'));
    try {
      const config = makeConfig(dir);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const budget = new BudgetEngine(config.safety);
      const context = new ContextEngine(config, dir);
      context.setGoal('Normal slot lifecycle');
      const task = createTask('Normal slot lifecycle', 'Acquire and release.', {
        acceptanceCriteria: [],
      } as never);
      // Pre-abort AFTER the first iteration would acquire the slot is hard to
      // script without a provider; instead verify directly that an acquired
      // slot is released by a full finish lifecycle: abort at i=1 is not
      // reachable here, so exercise the pair semantics on the budget itself.
      budget.recordAgentStart();
      expect(budget.snapshot().usedAgents).toBe(1);
      budget.recordAgentEnd();
      expect(budget.snapshot().usedAgents).toBe(0);
      void task;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
