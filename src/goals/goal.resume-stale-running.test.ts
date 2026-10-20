// Regression: a goal interrupted mid-run (crash, SIGKILL, abort) persists its
// in-flight tasks with status 'running'. On resume, TaskScheduler files those
// tasks into its running set but nothing ever executes them, and runGoal's
// loop spins forever: readyTasks() is empty (nothing pending) while
// runningCount > 0, so it sleeps 200ms at a time and isDone() never turns
// true. The user experiences that as "mochi goal resume hangs forever".
// Fix: at runGoal entry nothing can legitimately be running, so stale
// 'running' tasks are reset to 'pending' before scheduling.
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
  fake = await startFakeOpenAI([
    { content: 'done', finishReason: 'stop', completionTokens: 4 },
    { content: 'done', finishReason: 'stop', completionTokens: 4 },
    { content: 'done', finishReason: 'stop', completionTokens: 4 },
  ]);
  config = {
    model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 5, maxRuntimeMinutes: 5, maxConcurrentAgents: 2, contextBudgetTokens: 4000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
    telemetry: false, projectDir: '.mochi', configDir: '/tmp', quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
});

afterAll(async () => { await fake.close(); });

describe('goal resume with stale running tasks', () => {
  it('re-runs a task left running by a crash instead of hanging forever', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-goal-stale-'));
    try {
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const engine = new GoalEngine(config, workspace, new EventBus(), dir);
      const goal = await engine.createGoal('reply with the word done');

      // Simulate a crash mid-run: the task was started (status 'running') and
      // persisted, but the process died before it completed.
      const task = createTask('stale running', 'Reply with exactly the word: done.', { role: 'coder', acceptanceCriteria: [] });
      task.status = 'running';
      workspace.saveTasks(goal.id, [task]);

      // This is the `mochi goal resume` path: tasks are loaded from disk
      // (stale 'running' status intact) and handed to runGoal.
      const persisted = workspace.loadTasks(goal.id);
      const result = await engine.runGoal(goal, persisted);

      expect(result.success).toBe(true);
      expect(result.completedTasks.some((t) => t.id === task.id)).toBe(true);
      // The sanitized+completed state must be persisted back to the workspace.
      const after = workspace.loadTasks(goal.id);
      expect(after.find((t) => t.id === task.id)?.status).toBe('done');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
