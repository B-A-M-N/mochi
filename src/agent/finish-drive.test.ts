// Post-verify-pass finish drive: manual check recognition + harness finish.
// Proves the probe-3 failure mode is closed: verified work + a wandering
// model now concludes instead of burning hundreds of seconds re-checking.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { isManualCheckPass, POST_PASS_NUDGE_TURNS, POST_PASS_FINISH_TURNS, Agent } from './loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

describe('isManualCheckPass', () => {
  const pass = 'exit_code: 0\nstdout:\n# pass 11\n# fail 0';
  const fail = 'exit_code: 1\nstdout:\n# pass 10\n# fail 1';
  it('recognizes passing repo checks', () => {
    expect(isManualCheckPass('npm test', pass)).toBe(true);
    expect(isManualCheckPass('npm run test 2>&1 | tail -3', pass)).toBe(true);
    expect(isManualCheckPass('npx vitest run src/a.test.ts', pass)).toBe(true);
    expect(isManualCheckPass('npx tsc --noEmit', 'exit_code: 0\nstdout:\n')).toBe(true);
    expect(isManualCheckPass('pytest -q', pass)).toBe(true);
    expect(isManualCheckPass('cargo test', pass)).toBe(true);
    expect(isManualCheckPass('node --test', pass)).toBe(true);
  });
  it('rejects failures and non-check commands', () => {
    expect(isManualCheckPass('npm test', fail)).toBe(false);
    expect(isManualCheckPass('npm test', 'still running')).toBe(false);
    expect(isManualCheckPass('grep -n limit src/cli.ts', pass)).toBe(false);
    expect(isManualCheckPass('git status --short', pass)).toBe(false);
    expect(isManualCheckPass('node dist/cli.js session list --limit 3', pass)).toBe(false);
    expect(isManualCheckPass('sed -n 1,10p file', pass)).toBe(false);
  });
  it('cadence constants are sane', () => {
    expect(POST_PASS_NUDGE_TURNS).toBeGreaterThanOrEqual(2);
    expect(POST_PASS_FINISH_TURNS).toBeGreaterThan(POST_PASS_NUDGE_TURNS);
    expect(POST_PASS_FINISH_TURNS).toBeLessThanOrEqual(8);
  });
});

function makeConfig(dir: string, url: string): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: url, model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 40, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 8000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false,
    projectDir: '.mochi',
    configDir: resolve(dir, '.config/mochi'),
    quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
}

describe('post-pass finish drive end-to-end', () => {
  it('harness-finishes verified work when the model keeps re-checking', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-finish-'));
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'p', scripts: { test: 'node -e "process.exit(0)"' } }));
    writeFileSync(resolve(dir, 'a.ts'), 'export const a = 1;');
    writeFileSync(resolve(dir, 'b.ts'), 'export const b = 2;');
    // Turn 1 verifies via shell (exit 0 → arms the drive); following turns
    // just re-read files (the probe-3 tail). Nudge at 3, harness-finish at 6.
    const scripted: Array<{ content: string; toolCalls: unknown[]; finishReason: string }> = [
      {
        content: 'Running tests.',
        toolCalls: [{ id: 's-1', type: 'function', function: { name: 'shell', arguments: JSON.stringify({ command: 'npm test', timeout: 30 }) } }],
        finishReason: 'tool_calls',
      },
      ...Array.from({ length: 12 }, (_, k) => ({
        content: k % 2 === 0 ? 'Double-checking a.' : 'Double-checking b.',
        toolCalls: [{
          id: `r-${k}`, type: 'function',
          function: { name: 'read', arguments: JSON.stringify({ path: k % 2 === 0 ? 'a.ts' : 'b.ts' }) },
        }],
        finishReason: 'tool_calls',
      })),
    ];
    const fake = await startFakeOpenAI(scripted);
    try {
      const config = makeConfig(dir, fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('Add a feature with tests');
      const task = createTask('Add a feature with tests', 'Add it and verify green.', {
        acceptanceCriteria: ['tests pass'],
      } as never);
      const agent = new Agent({ role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context });
      const result = await agent.run(task);
      expect(result.success).toBe(true);
      expect(result.stopReason).toBe('completed');
      expect(result.summary).toContain('Complete (verified)');
      // 1 verify + nudge at 3 + finish at 6 → ~7 turns, far short of budget.
      expect(fake.requests.length).toBeLessThan(15);
    } finally {
      await fake.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
