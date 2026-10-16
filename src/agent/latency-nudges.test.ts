// Latency pins: the two protocol-level turn-killers.
//
// Arena profiling (2026-10-16) showed a two-line answer task spending 5 model
// round-trips (~14-20s wall): list dir → read → write → READ-BACK → verbose
// report. The fixes are (a) shipping the workspace listing in the preflight
// prompt so turn 1 reads directly, and (b) a just-in-time "trust the tool
// result" nudge after successful mutations so the model never spends a turn
// re-reading its own write. Both are pinned here against regression.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Agent } from './loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-latency-'));
  mkdirSync(resolve(dir, 'src'));
  writeFileSync(resolve(dir, 'src', 'add.js'), 'export function add(a,b){return a+b;}\n');
  writeFileSync(resolve(dir, 'README.md'), '# demo\n');
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function makeConfig(url: string): MochiConfig {
  return {
    model: { provider: 'openai', baseUrl: url, model: 'fake-model' },
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false,
    projectDir: '.mochi',
    quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
}

describe('latency: workspace listing in preflight', () => {
  it('ships the file listing so the model never spends a turn enumerating', async () => {
    const fake = await startFakeOpenAI([
      { content: 'Added a noop change.', finishReason: 'stop' },
    ]);
    try {
      const config = makeConfig(fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      const agent = new Agent({ role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context });
      // Non-chat task (fix lane) so the preflight path runs.
      await agent.run(createTask('fix the bug in src/add.js', 'fix the bug in src/add.js'));

      const msgs = context.getMessages().map((m) => String(m.content ?? '')).join('\n');
      expect(msgs).toContain('Workspace files (');
      expect(msgs).toContain('src/add.js');
      expect(msgs).toContain('instead of listing directories first');
    } finally {
      await fake.close();
    }
  }, 60_000);
});

describe('latency: trust-the-result nudge after successful mutations', () => {
  it('tells the model the write is authoritative instead of letting it re-read', async () => {
    const fake = await startFakeOpenAI([
      { finishReason: 'tool_calls', toolCalls: [{ id: 'w1', function: { name: 'write', arguments: JSON.stringify({ path: 'out.txt', content: 'ok\n' }) } }] },
      { content: 'Done.', finishReason: 'stop' },
    ]);
    try {
      const config = makeConfig(fake.url);
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      const agent = new Agent({ role: 'coder', config, workspace, events: new EventBus(), cwd: dir, context });
      await agent.run(createTask('create out.txt containing ok', 'create out.txt containing ok'));

      expect(existsSync(resolve(dir, 'out.txt'))).toBe(true);
      const msgs = context.getMessages().map((m) => String(m.content ?? '')).join('\n');
      expect(msgs).toContain('Result trust:');
      expect(msgs).toContain('Do NOT spend a turn re-reading');
    } finally {
      await fake.close();
    }
  }, 60_000);
});
