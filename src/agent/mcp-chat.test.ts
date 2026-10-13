// MCP connect spam: chat turns must never spawn/handshake MCP servers.
// Regression: loadMcpInRun ran on iteration 0 of EVERY run, so a greeting
// spawned every configured server, re-advertised their tools past the chat
// trim, and produced connect chatter the model then poked at.
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
    safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
    permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
    telemetry: false,
    projectDir: '.mochi',
    quiet: true, verbose: false, debug: false,
  } as unknown as MochiConfig;
}

describe('chat turns skip MCP loading', () => {
  it('a greeting with dead MCP servers configured connects to nothing', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-mcp-chat-'));
    const fake = await startFakeOpenAI([
      { content: 'Hello! How can I help?', finishReason: 'stop' },
    ]);
    try {
      const config = makeConfig(dir, fake.url);
      // A server that cannot possibly connect: any load attempt would emit
      // [mcp] agent:log lines (registered / unavailable / load failed).
      config.mcpServers = { dead: { command: '/nonexistent-mcp-xyz', args: [] } } as never;
      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('hi there friend');
      const bus = new EventBus();
      const mcpChatter: string[] = [];
      bus.onAll((e) => {
        if (e.type === 'agent:log' && String((e as { message?: string }).message ?? '').includes('[mcp]')) {
          mcpChatter.push(String((e as { message?: string }).message));
        }
      });
      const agent = new Agent({ role: 'coder', config, workspace, events: bus, cwd: dir, context });
      const result = await agent.run(createTask('hi there friend', 'hi there friend'));
      expect(result.success).toBe(true);
      expect(result.stopReason).toBe('completed');
      expect(mcpChatter).toEqual([]);
    } finally {
      await fake.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
