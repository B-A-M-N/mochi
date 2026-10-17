import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Agent } from './loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

function makeConfig(dir: string, url: string): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: url, model: 'fake-model' },
    safety: {
      mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 6,
      maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 8000,
    },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false, projectDir: '.mochi',
    configDir: resolve(dir, '.config/mochi'),
    quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
}

/** MCH-134: the lean/read/chat tiers silently defer tools. The model must see a
 *  TOOLSET NOTE naming what was deferred and the load_tools restore path. */
describe('MCH-134 deferred-tools visibility', () => {
  it('lean-tier task: TOOLSET NOTE reaches the model with deferred names + restore path', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-mch134-'));
    const fake = await startFakeOpenAI([
      // model responds to the note: it knows about deferred tools now
      { content: 'Acknowledged. Working with the lean toolset.', finishReason: 'stop' },
    ]);
    try {
      const config = makeConfig(dir, fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('Create a tiny util file');
      const task = createTask('create util file', 'create a small helper file util.ts');
      const agent = new Agent({ role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context });
      await agent.run(task);
      const systemTexts = fake.requests
        .flatMap((r) => r.body?.messages ?? [])
        .filter((m) => m?.role === 'system')
        .map((m) => String(m.content ?? ''));
      const note = systemTexts.find((t) => t.includes('TOOLSET NOTE'));
      expect(note, 'expected a TOOLSET NOTE system message for a lean-tier task').toBeTruthy();
      expect(note).toContain('load_tools');
      expect(note).toContain('Deferred');
      // lean tier strips heavy tools like subagent — the note must name at least one deferred tool
      expect(note).toMatch(/subagent|blast_radius|web_search|memory/);
    } finally {
      await fake.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
