// B25 caller-level regression: a degraded usage report must clear the sticky
// reported-prompt signal in a REAL loop run.
//
// The context-level hunk (recordReportedUsage clearing on 0/undefined) is
// covered in vnext-phases.test.ts. This test exercises the shape the bundled
// adapters actually produce when a provider stops sending real usage: the
// response still carries a usage object, but with counts coerced to ZERO
// (openai.ts:356-362, anthropic.ts:56, gemini.ts:70). With the bug, the loop
// runs, the zeroed report is ignored, and the seeded value (turn 1's
// prompt_tokens: 10) freezes effectiveContextTokens() — and with it the
// stage-2 compaction gates — forever.
import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Agent } from './loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import type { MochiConfig } from '../types.js';

let requests = 0;
let agentContext: ContextEngine | null = null;

function startFake() {
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      requests++;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunk = (obj: any) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      chunk({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] });
      if (requests === 1) {
        // Turn 1: a real tool call AND usage (seeds lastReportedPromptTokens
        // with prompt_tokens: 10), forcing a second request.
        chunk({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'read', arguments: '{"path":"notes.txt"}' } }] }, finish_reason: null }] });
        chunk({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
      } else {
        // Turn 2+: valid completion whose usage reports ZERO prompt tokens —
        // the shape every bundled adapter actually yields on a degraded
        // endpoint (openai.ts:356-362, anthropic.ts:56, gemini.ts:70 coerce
        // missing counts to ?? 0). recordReportedUsage(0) must clear the
        // sticky seed; with the bug the 10 freezes forever.
        chunk({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: { content: 'Done. The answer is 42.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 0, completion_tokens: 5, total_tokens: 5 } });
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(0, () => resolve({
      port: (server.address() as any).port,
      close: () => new Promise<void>((r) => server.close(() => r())),
    }));
  });
}

describe('missing usage object unsticks reported-prompt signal (B25, caller level)', () => {
  let fake: Awaited<ReturnType<typeof startFake>> | null = null;
  let dir: string | null = null;
  afterEach(async () => {
    if (fake) await fake.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
    fake = null; dir = null; agentContext = null; requests = 0;
  });

  it('clears the reported value when the provider reports zeroed usage', async () => {
    fake = await startFake();
    dir = mkdtempSync(resolve(tmpdir(), 'mochi-b25-loop-'));
    const config = {
      model: { provider: 'freeinference', baseUrl: `http://localhost:${fake.port}`, model: 'm', apiKey: 'k' },
      safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 6, maxRuntimeMinutes: 2, maxConcurrentAgents: 1, contextBudgetTokens: 8000 },
      permissions: { read: true, write: true, shell: true, network: true, gitDestructive: false },
      projectDir: dir,
    } as unknown as MochiConfig;
    const workspace = new Workspace(dir, '.mochi');
    workspace.ensure();
    const context = new ContextEngine(config, dir);
    agentContext = context;
    context.setGoal('answer the question');
    const agent = new Agent({ id: 'b25-agent', role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context });
    const result = await agent.run({ id: 't1', title: 'Answer', description: 'Give the result.', role: 'coder', status: 'pending', priority: 1, dependencies: [], acceptanceCriteria: [], attempts: [], createdAt: 0, updatedAt: 0 } as any);
    expect(result.success).toBe(true);
    // Two responses hit the fake server; only the first carried real usage
    // (the second's usage reported prompt_tokens: 0).
    expect(requests).toBeGreaterThanOrEqual(2);
    // With the sticky bug, the frozen 10 (seeded by turn 1) is still returned
    // after the turn-2 zeroed report.
    expect(agentContext!.effectiveContextTokens()).not.toBe(10);
    // The fallback signal is the live packet estimate (tracks transcript
    // growth), strictly above the tiny reported seed.
    expect(agentContext!.effectiveContextTokens()).toBeGreaterThan(10);
  }, 60_000);
});
