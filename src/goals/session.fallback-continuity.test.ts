// Integration: conversation continuity survives WITHOUT a sqlite driver.
// The TUI keeps one Runtime per session; every prompt builds a fresh
// Agent + ContextEngine, and continuity comes from the session store tail
// being seeded back in (goal.ts runTask). With node:sqlite missing that
// seeding used to be silently skipped (`if (hasSqlite())`) — every follow-up
// ran blind. Force the JSON fallback and pin that a follow-up request still
// carries the prior turn into the model's context.
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Workspace } from '../workspace.js';
import { EventBus } from '../events.js';
import { GoalEngine } from './goal.js';
import { createTask } from './task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';

let fake: Awaited<ReturnType<typeof startFakeOpenAI>>;
afterAll(async () => { if (fake) await fake.close(); });

describe('session continuity on the JSON fallback', () => {
  it('a follow-up prompt sees the prior turn even with sqlite forced off', async () => {
    process.env.MOCHI_SQLITE = 'off';
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-sessfb-int-'));
    try {
      fake = await startFakeOpenAI([
        { content: 'Noted the codeword.', finishReason: 'stop' },
        { content: 'zebra-42', finishReason: 'stop' },
        { content: 'summary one', finishReason: 'stop' },
        { content: 'summary two', finishReason: 'stop' },
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

      // Turn 1 and turn 2 share one session id — the TUI's shape.
      const sid = 'sess-fallback-continuity';
      const g1 = await engine.createGoal('Remember the codeword');
      await engine.runGoal(g1, [createTask('remember', 'Remember that the codeword is zebra-42', { role: 'coder', acceptanceCriteria: [] })], [], undefined, sid);
      const g2 = await engine.createGoal('What was the codeword');
      await engine.runGoal(g2, [createTask('recall', 'What codeword did I tell you? Answer briefly.', { role: 'coder', acceptanceCriteria: [] })], [], undefined, sid);

      // The second task's model request must carry the first turn.
      const req = fake.requests.find((r) => JSON.stringify(r.body.messages ?? []).includes('What codeword did I tell you'));
      expect(req, 'second-turn request exists').toBeDefined();
      const dumped = JSON.stringify(req!.body.messages);
      expect(dumped, 'prior user turn seeded').toContain('the codeword is zebra-42');
      expect(dumped, 'prior assistant turn seeded').toContain('Noted the codeword');
    } finally {
      delete process.env.MOCHI_SQLITE;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
