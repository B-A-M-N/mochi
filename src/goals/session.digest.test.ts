// Working-context digest must survive the turn boundary. Final summaries
// carry no "which file did you read" — the digest does (runDigest -> session
// store tail -> seeded back on the next turn). Assert the second-turn model
// request contains the prior turn's digest of the file path.
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Workspace } from '../workspace.js';
import { EventBus } from '../events.js';
import { GoalEngine } from './goal.js';
import { createTask } from './task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';

let fake: Awaited<ReturnType<typeof startFakeOpenAI>>;
afterAll(async () => { if (fake) await fake.close(); });

describe('working-context digest survives turns', () => {
  it('the next turn\'s request contains the prior turn\'s run-digest', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-digest-'));
    try {
      mkdirSync(resolve(dir, 'src'), { recursive: true });
      writeFileSync(resolve(dir, 'src', 'data.txt'), 'codeword: quokka-7\n');
      fake = await startFakeOpenAI([
        // Turn 1: model reads the file, then acknowledges.
        { finishReason: 'tool_calls', toolCalls: [{ id: 'r1', function: { name: 'read', arguments: JSON.stringify({ path: 'src/data.txt' }) } }] },
        { content: 'Noted the codeword quokka-7.', finishReason: 'stop' },
        // Turn 2: a follow-up that never names the file.
        { content: 'done', finishReason: 'stop' },
      ]);
      const cfg = {
        model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
        safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
        permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
        telemetry: false, projectDir: '.mochi', quiet: true, verbose: false, debug: false,
      } as unknown as import('../types.js').MochiConfig;
      const ws = new Workspace(dir, '.mochi');
      ws.ensure();
      const engine = new GoalEngine(cfg, ws, new EventBus(), dir);
      const sid = 'digest-survivor';

      await engine.runGoal(await engine.createGoal('read codeword'), [createTask('read-data', 'Read src/data.txt to learn the codeword', { role: 'coder', acceptanceCriteria: [] })], [], undefined, sid);
      await engine.runGoal(await engine.createGoal('recall the file'), [createTask('recall', 'Which file did you read in the previous turn? One line.', { role: 'coder', acceptanceCriteria: [] })], [], undefined, sid);

      const req = fake.requests.find((r) => JSON.stringify(r.body.messages ?? []).includes('Which file did you read'));
      expect(req, 'second-turn request exists').toBeDefined();
      const dumped = JSON.stringify(req!.body.messages);
      expect(dumped, 'prior digest survives').toContain('run-digest');
      expect(dumped, 'digest carries the read path').toContain('src/data.txt');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
