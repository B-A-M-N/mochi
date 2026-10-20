// I2 regression: MCP servers must be connected ONCE per run.
//
// Two independent stacks used to connect the same servers in one run:
//   - run() pre-loop: buildMcpTools (mcp/tools.ts), tools named srv__tool
//   - loadMcpInRun at i===0: loadMcpTools (tools/mcp.ts), tools named mcp_srv_tool
// Neither set the other's guard, so every non-chat run with mcpServers
// spawned each server twice and advertised every tool twice.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { Mochi } from '../sdk.js';
import { startFakeOpenAI } from '../testutil/fake-openai.js';

// Minimal SPEC-COMPLIANT stdio MCP server: initialize + tools/list answered,
// notifications never answered.
const SERVER_SRC = `
const readline = require('node:readline');
const send = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === undefined) return; // notifications are never answered
  let result = {};
  if (msg.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'once', version: '1' } };
  else if (msg.method === 'tools/list') result = { tools: [{ name: 'hello', description: 'say hello', inputSchema: { type: 'object', properties: {} } }] };
  send({ jsonrpc: '2.0', id: msg.id, result });
});
console.error('spawned'); // observable spawn marker on stderr
`;

describe('MCP single-connect invariant', () => {
  it('connects a configured MCP server exactly once per run', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-mcp-once-'));
    execSync('git init -q ' + dir);
    writeFileSync(resolve(dir, 'README.md'), '# t');
    const serverScript = resolve(dir, 'mini-mcp.cjs');
    writeFileSync(serverScript, SERVER_SRC);

    const fake = await startFakeOpenAI([{ content: 'All done, tests pass.', finishReason: 'stop' }] as never);
    const m = Mochi.create({
      cwd: dir,
      config: {
        model: { provider: 'openai', baseUrl: fake.url, apiKey: 'k', model: 'fake-model' } as never,
        mcpServers: { once: { command: process.execPath, args: [serverScript] } },
      },
    });
    const mcpLogs: string[] = [];
    const off = m.onAny((e: { type: string; message?: string }) => {
      if (e.type === 'agent:log' && typeof e.message === 'string' && e.message.includes('mcp')) mcpLogs.push(e.message);
    });
    try {
      // Non-chat task text so the run loads MCP servers at all.
      await m.prompt('Create greeting.txt containing hello world and print it. fix tests too');

      const fromServer = mcpLogs.filter((s) => s.includes("from server 'once'"));
      const connected = mcpLogs.filter((s) => s.includes('connected once'));
      expect(fromServer.length, `one buildMcpTools connect, got: ${JSON.stringify(mcpLogs)}`).toBe(1);
      expect(connected.length, `no second-stack connect, got: ${JSON.stringify(mcpLogs)}`).toBe(0);
    } finally {
      off();
      fake.close();
      try { m.close(); } catch { /* best-effort */ }
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
