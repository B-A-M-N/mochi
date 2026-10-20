// B18 regression: runOne records EVERY finished task into the persistent
// workspace `completedTasks` ledger — success or failure. A task that failed
// (verification failed, model error, aborted) lands in a ledger whose only
// semantic is "completed": context.ts surfaces it to future sessions as
// "Completed tasks: X", and a later goal treats the failed work as already
// done. The ledger entry must record only successful task completions.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { GoalEngine } from './goal.js';
import { Workspace } from '../workspace.js';
import { EventBus } from '../events.js';
import { createTask } from './task.js';
import { startFakeOpenAI, type FakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

let fake: FakeOpenAI;
let config: MochiConfig;

beforeAll(async () => {
  // Script: the model "finishes" but the verifier rejects it (verify command
  // exits 1), so the task ends failed. Extra entries are harmless: the fake
  // repeats its last response when exhausted.
  fake = await startFakeOpenAI([
    { content: 'claiming done', finishReason: 'stop', completionTokens: 4 },
    { content: '{"status":"FAIL","passed":[],"failed":["acceptance not met"],"recommendation":"not actually done"}', finishReason: 'stop', completionTokens: 40 },
  ]);
  config = {
    model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 5, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
    telemetry: false, projectDir: '.mochi', configDir: '/tmp', quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
});

afterAll(async () => { await fake.close(); });

describe('completedTasks ledger records only successful tasks (B18)', () => {
  it('a FAILED task is not recorded into the persistent completed ledger', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-goal-ledger-'));
    try {
      // Verify command always fails → the agent's completion claim cannot pass.
      const { writeFileSync } = await import('node:fs');
      writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "process.exit(1)"' } }));
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const engine = new GoalEngine(config, workspace, new EventBus(), dir);
      const goal = await engine.createGoal('do a thing that fails');
      const task = createTask('failing task', 'Do the failing thing.', { role: 'coder', acceptanceCriteria: ['never satisfied'] });
      task.verificationCommand = 'node -e "process.exit(1)"';

      const result = await engine.runGoal(goal, [task]);
      expect(result.success).toBe(false);

      // The task must NOT be in the persistent completedTasks ledger.
      const state = workspace.loadState();
      expect(state.completedTasks).not.toContain('failing task');

      // The failed status is persisted on the task itself (unchanged behavior).
      const after = workspace.loadTasks(goal.id);
      expect(after.find((t) => t.id === task.id)?.status).toBe('failed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 90_000);

  it('a SUCCESSFUL task is still recorded (no over-correction)', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-goal-ledger-ok-'));
    try {
      // Separate fake so this test does not share the failure script.
      const okFake = await startFakeOpenAI([
        { content: 'Done with the task.', finishReason: 'stop', completionTokens: 4 },
        { content: '{"status":"PASS","passed":["criteria met"],"failed":[],"recommendation":"Complete"}', finishReason: 'stop', completionTokens: 40 },
      ]);
      const okConfig = {
        ...config,
        model: { provider: 'openai', baseUrl: okFake.url, model: 'fake-model' },
      } as unknown as MochiConfig;
      const { writeFileSync } = await import('node:fs');
      writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "process.exit(0)"' } }));
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const engine = new GoalEngine(okConfig, workspace, new EventBus(), dir);
      const goal = await engine.createGoal('do a passing thing');
      const task = createTask('passing task', 'Do the passing thing.', { role: 'coder', acceptanceCriteria: ['always satisfied'] });
      task.verificationCommand = 'node -e "process.exit(0)"';

      const result = await engine.runGoal(goal, [task]);
      expect(result.success).toBe(true);
      const state = workspace.loadState();
      expect(state.completedTasks).toContain('passing task');
      await okFake.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 90_000);
});
