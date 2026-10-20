// B19 regression: decompose() drops dependency edges that reference a task
// LATER in the plan (forward references). At creation time dependencies are
// mapped through titleToId, which only contains EARLIER tasks — a forward ref
// became '' and was filtered out before the title-link second pass (which was
// written exactly for this case but receives nothing to link). Result: a
// plan like [B depends on A... wait, reversed: task 1 depends on task 2]
// silently loses the edge and the scheduler runs the dependent task FIRST.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { GoalEngine } from './goal.js';
import { Workspace } from '../workspace.js';
import { EventBus } from '../events.js';
import { startFakeOpenAI, type FakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

let fake: FakeOpenAI;
let config: MochiConfig;

beforeAll(async () => {
  // The model emits a plan where the FIRST task depends on the SECOND
  // (forward reference), plus a self-contained third task.
  const plan = JSON.stringify([
    {
      title: 'Wire up build',
      description: 'Wire the build using the config produced by Write config.',
      role: 'coder',
      dependencies: ['Write config'],
      acceptanceCriteria: ['build wired'],
    },
    {
      title: 'Write config',
      description: 'Produce the config file.',
      role: 'coder',
      dependencies: [],
      acceptanceCriteria: ['config exists'],
    },
    {
      title: 'Write docs',
      description: 'Document the tool.',
      role: 'coder',
      dependencies: [],
      acceptanceCriteria: ['docs exist'],
    },
  ]);
  fake = await startFakeOpenAI([
    { content: plan, finishReason: 'stop', completionTokens: 120 },
  ]);
  config = {
    model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 5, maxRuntimeMinutes: 5, maxConcurrentAgents: 2, contextBudgetTokens: 4000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
    telemetry: false, projectDir: '.mochi', configDir: '/tmp', quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
});

afterAll(async () => { await fake.close(); });

describe('decompose dependency forward references (B19)', () => {
  it('keeps a dependency edge that references a later task', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-decomp-fwd-'));
    try {
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const engine = new GoalEngine(config, workspace, new EventBus(), dir);
      const goal = await engine.createGoal('Build the thing with config');
      const tasks = await engine.decompose(goal);

      const wire = tasks.find((t) => t.title === 'Wire up build');
      const configTask = tasks.find((t) => t.title === 'Write config');
      expect(wire).toBeDefined();
      expect(configTask).toBeDefined();
      // The forward-referencing edge must survive: Wire up build depends on
      // Write config's id. With the bug the edge was dropped at creation and
      // dependencies ended [].
      expect(wire!.dependencies).toContain(configTask!.id);

      // Control: a no-dependency task keeps no edges.
      const docs = tasks.find((t) => t.title === 'Write docs');
      expect(docs!.dependencies).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
