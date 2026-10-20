import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { rmTmp } from '../testutil/rm-tmp.js';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';
import { recordHarnessIssue } from '../core/harness-issues.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'selfrepair-'));
  writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0' }));
});
afterAll(() => { rmTmp(dir); });

function makeConfig(url: string, selfRepair?: boolean): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: url, model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 4, maxRuntimeMinutes: 2, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false, projectDir: '.mochi', quiet: true, verbose: false, debug: false,
    selfRepair,
  } as unknown as MochiConfig;
}

describe('self-repair: auto-repair spawn when enabled', () => {
  it('with selfRepair:true a repair pass spawns even outside the harness repo', async () => {
    const ws = new Workspace(dir, '.mochi');
    ws.ensure();
    // Seed an open issue directly so we test the spawn machinery in isolation —
    // recording itself is exercised by the pure classifier tests.
    recordHarnessIssue(ws.dir, {
      kind: 'tool_error_loop', title: 'synthetic repeated tool failure',
      evidence: 'read ENOENT x 3', signature: 'synthharnessissue',
    } as any, 'synthetic task', Date.now());

    const fake = await startFakeOpenAI([
      { content: 'Synthetic failure context.', finishReason: 'stop' },
      { content: 'Repair attempted — verified done.', finishReason: 'stop' },
    ]);
    try {
      const { Runtime } = await import('../runtime.js');
      const rt = new Runtime({ cwd: dir, config: makeConfig(fake.url, true) });
      const result = await rt.runPrompt('A tiny change for the synthetic task.');

      expect(result).toContain('[self-repair pass ran for harness issue');
      expect(rt.activeSessionId).toBeTruthy();
      expect(fake.requests.length).toBeGreaterThanOrEqual(2);
    } finally {
      await fake.close();
    }
  }, 90_000);
});
