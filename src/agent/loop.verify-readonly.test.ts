// I6 regression: dangerous tools must never be classified read-only.
// 'verify' executes an arbitrary shell command (permission:'shell',
// dangerous:true; tools/verify.ts runs the command verbatim). It used to sit
// in isReadOnly(), which let mid-stream speculative execution (MCH-64) fire
// it DURING streaming with no approval gate — the side effect happened even
// when the approval handler denied the call moments later.
// Observable: with a strict policy + denying handler, the verify command's
// file marker must not exist. Old code: spec-exec ran it mid-stream → marker
// present. Fixed: not read-only → no spec-exec; gated → deny → never runs.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { Agent } from '../agent/loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

function makeConfig(dir: string, url: string): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: url, model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false,
    projectDir: '.mochi',
    configDir: resolve(dir, '.config/mochi'),
    quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
}

describe('isReadOnly: dangerous tools are not read-only', () => {
  it('a denied verify never executes — not even via mid-stream speculative execution', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-verify-ro-'));
    execSync('git init -q ' + dir);
    writeFileSync(resolve(dir, 'README.md'), '# t');
    const marker = resolve(dir, 'verify-ran.marker');
    const markerCmd = `node -e "require('fs').writeFileSync(process.argv[1], 'ran')" ${JSON.stringify(marker)}`;
    const fake = await startFakeOpenAI([
      {
        content: 'Verifying.',
        finishReason: 'tool_calls',
        toolCalls: [{ id: 'v1', type: 'function', function: { name: 'verify', arguments: JSON.stringify({ command: markerCmd }) } }],
      },
      { content: 'Verification was denied; reporting without it.', finishReason: 'stop' },
    ]);
    try {
      const config = makeConfig(dir, fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('verify');
      const asked: string[] = [];
      const agent = new Agent({
        role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context,
        permPolicy: 'strict',
        approvalHandler: async (req) => { asked.push(req.tool); return 'deny'; },
      });
      const result = await agent.run(createTask('Verify the project tests', 'Run the project verification (verify tool) and report.'));
      expect(result.success).toBe(true);
      expect(asked, 'the approval gate must be consulted for verify').toContain('verify');
      expect(existsSync(marker), 'denied verify must never execute its command (old bug: mid-stream spec-exec ran it before the gate denied)').toBe(false);
    } finally {
      await fake.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
