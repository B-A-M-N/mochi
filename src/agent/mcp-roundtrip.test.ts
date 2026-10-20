// MCH-17: MCP round-trip integration test — prove the FULL loop that the
// competitor matrix flagged as unverified: a configured MCP server is
// discovered (tools/list), the model is offered its tool, the model CALLS it,
// the server executes it, and the tool result is transcribed back into the
// model context on the next turn. Without this, MCP can silently rot: servers
// connect, tools look registered, and nothing survives contact with a real run.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Agent } from './loop.js';
import { ContextEngine } from '../context.js';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { createTask } from '../goals/task.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';
import type { MochiConfig } from '../types.js';

// Minimal stdio MCP server: initialize/tools/list/tools/call only. The echo
// result embeds a marker so the test can prove THE SERVER's output (not a
// hallucination) reached the model context on the second request.
const SERVER_SRC = `
const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const send = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
  const ok = (result) => send({ jsonrpc: '2.0', id: msg.id, result });
  switch (msg.method) {
    case 'initialize': ok({ protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'rt-fake', version: '1' } }); break;
    case 'notifications/initialized': ok({}); break;
    case 'tools/list':
      ok({ tools: [{ name: 'echo', description: 'Echo text back with a marker', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }] });
      break;
    case 'tools/call': {
      const args = (msg.params && msg.params.arguments) || {};
      ok({ content: [{ type: 'text', text: 'echo:' + args.text + ':MCP_RT_MARKER' }] });
      break;
    }
    default: ok({});
  }
});
`;

let dir: string;
let serverScript: string;

beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-mcp-rt-'));
  serverScript = resolve(dir, 'rt-mcp-server.cjs');
  writeFileSync(serverScript, SERVER_SRC);
});
afterAll(() => {
  // The agent closes its own MCP connections on finish (best-effort), so the
  // fixture only needs to clean the temp dir.
  rmSync(dir, { recursive: true, force: true });
});

describe('MCP round-trip (MCH-17)', () => {
  it('lists → offers → calls → transcribes the MCP tool result into the model context', async () => {
    const fake = await startFakeOpenAI([
      // Turn 1: model picks the MCP tool.
      {
        finishReason: 'tool_calls',
        toolCalls: [{ id: 'call_rt_1', function: { name: 'rt__echo', arguments: '{"text":"hello-rt"}' } }],
      },
      // Turn 2: model sees the tool result and finishes.
      { content: 'Round trip complete.', finishReason: 'stop' },
    ]);
    try {
      const config = {
        model: { provider: 'openai', baseUrl: fake.url, model: 'fake-model' },
        safety: { mode: 'auto', commandTimeoutSeconds: 10, maxIterations: 10, maxRuntimeMinutes: 5, maxConcurrentAgents: 1, contextBudgetTokens: 4000 },
        permissions: { read: true, write: true, shell: true, network: true, gitDestructive: true },
        telemetry: false,
        projectDir: '.mochi',
        quiet: true, verbose: false, debug: false,
        mcpServers: {
          rt: { command: process.execPath, args: [serverScript] },
        },
      } as unknown as MochiConfig;

      const workspace = new Workspace(dir, '.mochi');
      workspace.ensure();
      const context = new ContextEngine(config, dir);
      context.setGoal('use the rt echo tool');
      const bus = new EventBus();
      const toolEvents: string[] = [];
      bus.onAll((e) => {
        if (e.type === 'tool:called') toolEvents.push(`called:${(e as { tool?: string }).tool}`);
        if (e.type === 'tool:completed') toolEvents.push(`completed:${(e as { tool?: string }).tool}`);
      });

      const agent = new Agent({ role: 'coder', config, workspace, events: bus, cwd: dir, context });
      const result = await agent.run(createTask('use the rt echo tool', 'use the rt echo tool'));

      // 1. Discovery: the MCP tool was offered to the model on turn 1.
      // Name note: single-connect per run (I2) means the tool registers ONLY
      // under the newer srv__tool namespace (mcp/tools.ts) — the old
      // mcp_<server>_<tool> duplicate from tools/mcp.ts no longer exists.
      expect(fake.requests.length).toBeGreaterThanOrEqual(2);
      const firstTools = (fake.requests[0].body.tools ?? []) as Array<{ function?: { name?: string } }>;
      expect(firstTools.some((t) => t.function?.name === 'rt__echo')).toBe(true);

      // 2. Transcription: the SERVER's echoed marker came back in the model
      //    context on turn 2 (tool role message), proving list→call→result.
      const secondMessages = JSON.stringify(fake.requests[1].body.messages);
      expect(secondMessages).toContain('MCP_RT_MARKER');
      expect(secondMessages).toContain('hello-rt');

      // 3. The run itself completed against the real provider/MCP path.
      expect(result.success).toBe(true);
      expect(toolEvents).toContain('completed:rt__echo');
    } finally {
      await fake.close();
    }
  }, 60_000);
});
