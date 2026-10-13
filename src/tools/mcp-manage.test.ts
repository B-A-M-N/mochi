// mcp-manage: universal spec parsing, .mcp.json round-trips, live connect test.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  parseMcpSpec,
  addMcpServerConfig,
  addMcpSpecConfig,
  removeMcpServerConfig,
  listConfiguredMcpServers,
  readMcpServerConfig,
  testMcpServerConfig,
  BUILTIN_MCP_SERVERS,
} from './mcp-manage.js';
import { mcpManageTool } from './mcp-manage.js';
import type { ToolContext } from './types.js';
import { EventBus } from '../events.js';

// Minimal fake stdio MCP server: handshake + tools/list only.
const SERVER_SRC = `
const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
const send = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const ok = (result) => send({ jsonrpc: '2.0', id: msg.id, result });
  if (msg.method === 'initialize') ok({ protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fake', version: '1' } });
  else if (msg.method === 'tools/list') ok({ tools: [{ name: 'ping', description: 'pong', inputSchema: { type: 'object', properties: {} } }] });
  else ok({});
});
`;

let dir: string;
let serverScript: string;
beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-mcp-manage-'));
  serverScript = resolve(dir, 'fake-mcp.cjs');
  writeFileSync(serverScript, SERVER_SRC);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const proj = (name: string): string => {
  const d = resolve(dir, name);
  rmSync(d, { recursive: true, force: true });
  mkdirSync(d, { recursive: true });
  return d;
};

describe('parseMcpSpec', () => {
  it('resolves built-in ids', () => {
    const r = parseMcpSpec('mcp-github');
    expect('install' in r && r.install.id).toBe('mcp-github');
  });

  it('parses npm:, npx:, uvx:, cmd:, and https specs', () => {
    const npm = parseMcpSpec('npm:@modelcontextprotocol/server-github');
    expect('install' in npm && npm.install.entry).toEqual({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] });
    expect('install' in npm && npm.install.id).toBe('mcp-server-github');

    const uvx = parseMcpSpec('uvx:mcp-server-fetch --port 8000');
    expect('install' in uvx && uvx.install.entry).toEqual({ command: 'uvx', args: ['mcp-server-fetch', '--port', '8000'] });

    const url = parseMcpSpec('https://mcp.example.com/rpc');
    expect('install' in url && url.install.entry).toEqual({ url: 'https://mcp.example.com/rpc' });
    expect('install' in url && url.install.id).toContain('example-com');

    const cmd = parseMcpSpec('cmd:python3 ./server.py --stdio');
    expect('install' in cmd && cmd.install.entry).toEqual({ command: 'python3', args: ['./server.py', '--stdio'] });
  });

  it('accepts a bare scoped npm package, rejects bare typos (never silent npm)', () => {
    const scoped = parseMcpSpec('@modelcontextprotocol/server-memory');
    expect('install' in scoped).toBe(true);
    const typo = parseMcpSpec('mcp-githb');
    expect('error' in typo && typo.error).toContain('Unknown MCP server');
    expect('error' in typo && typo.error).toContain('npm:<package>');
    expect(parseMcpSpec('')).toMatchObject({ error: expect.stringContaining('Empty') });
    expect(parseMcpSpec('not a real thing!!')).toMatchObject({ error: expect.stringContaining('Unknown MCP server') });
  });
});

describe('.mcp.json round-trips', () => {
  it('add (builtin + spec), duplicate refusal, list/read, remove', () => {
    const p = proj('rt1');
    const a = addMcpServerConfig(p, 'mcp-memory');
    expect(a.ok).toBe(true);
    const b = addMcpSpecConfig(p, 'npm:@modelcontextprotocol/server-github');
    expect(b.ok).toBe(true);
    expect(b.message).toContain('mcp-server-github');
    // Duplicate refuses without clobbering.
    const dup = addMcpServerConfig(p, 'mcp-memory');
    expect(dup.alreadyPresent).toBe(true);
    expect(listConfiguredMcpServers(p).sort()).toEqual(['mcp-memory', 'mcp-server-github']);
    expect(readMcpServerConfig(p, 'mcp-memory')).toMatchObject({ command: 'npx' });
    // Unrelated keys survive a remove.
    const doc = JSON.parse(readFileSync(resolve(p, '.mcp.json'), 'utf8'));
    doc.otherTool = { x: 1 };
    writeFileSync(resolve(p, '.mcp.json'), JSON.stringify(doc));
    const rm = removeMcpServerConfig(p, 'mcp-memory');
    expect(rm.ok).toBe(true);
    const after = JSON.parse(readFileSync(resolve(p, '.mcp.json'), 'utf8'));
    expect(after.otherTool).toEqual({ x: 1 });
    expect(listConfiguredMcpServers(p)).toEqual(['mcp-server-github']);
    expect(removeMcpServerConfig(p, 'mcp-nope').ok).toBe(false);
  });

  it('refuses corrupt files instead of overwriting', () => {
    const p = proj('rt2');
    writeFileSync(resolve(p, '.mcp.json'), '{not json');
    expect(addMcpServerConfig(p, 'mcp-memory').ok).toBe(false);
    expect(removeMcpServerConfig(p, 'mcp-memory').ok).toBe(false);
  });
});

describe('testMcpServerConfig (live connect)', () => {
  it('reports the tool inventory for a working server', async () => {
    const p = proj('live1');
    const added = addMcpSpecConfig(p, `cmd:${process.execPath} ${serverScript}`);
    expect(added.ok).toBe(true);
    const id = listConfiguredMcpServers(p)[0];
    const r = await testMcpServerConfig(p, id, { timeoutMs: 15_000 });
    expect(r.ok).toBe(true);
    expect(r.message).toContain('ping');
  }, 30_000);

  it('fails honestly for a dead command and unknown ids', async () => {
    const p = proj('live2');
    addMcpSpecConfig(p, 'cmd:/nonexistent-binary-xyz --stdio');
    const id = listConfiguredMcpServers(p)[0];
    const r = await testMcpServerConfig(p, id, { timeoutMs: 10_000 });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('failed to connect');
    expect((await testMcpServerConfig(p, 'mcp-nope')).ok).toBe(false);
  }, 30_000);
});

describe('builtin registry integrity (fake-prevention)', () => {
  it('every entry is installable: unique ids, url-or-command shape, real descriptions', () => {
    const ids = new Set<string>();
    for (const s of BUILTIN_MCP_SERVERS) {
      expect(s.id, 'duplicate id').not.toBe('');
      expect(ids.has(s.id), `duplicate id ${s.id}`).toBe(false);
      ids.add(s.id);
      // Exactly one transport: remote URL or local command (never neither,
      // never a command-less entry that would spawn nothing).
      const hasUrl = typeof s.url === 'string' && s.url.startsWith('https://');
      const hasCmd = typeof s.command === 'string' && s.command.length > 0 && Array.isArray(s.args);
      expect(hasUrl !== hasCmd, `${s.id} must have exactly one of url/command`).toBe(true);
      expect(s.description.length, `${s.id} needs a description`).toBeGreaterThan(20);
      expect(s.installHint && s.installHint.length > 0, `${s.id} needs an install hint`).toBe(true);
    }
    expect(BUILTIN_MCP_SERVERS.length).toBeGreaterThanOrEqual(20);
  });

  it('installs a URL builtin as a url entry (no fake command)', () => {
    const p = proj('url1');
    const r = addMcpServerConfig(p, 'mcp-exa');
    expect(r.ok).toBe(true);
    expect(readMcpServerConfig(p, 'mcp-exa')).toEqual({ url: 'https://mcp.exa.ai/mcp' });
  });
});

describe('mcp_manage tool actions', () => {
  const ctx = (cwd: string): ToolContext => ({
    cwd, workspace: {} as never, config: {} as never, events: new EventBus() as never, agentId: 't',
  });

  it('add/remove/test end-to-end through the tool', async () => {
    const p = proj('tool1');
    const c = ctx(p);
    expect(await mcpManageTool.execute({ action: 'add', server_id: 'mcp-memory' }, c)).toContain('mcp-memory');
    expect(await mcpManageTool.execute({ action: 'add', server_id: 'npm:@modelcontextprotocol/server-github' }, c)).toContain('mcp-server-github');
    expect(await mcpManageTool.execute({ action: 'remove' }, c)).toContain('Configured:');
    expect(await mcpManageTool.execute({ action: 'remove', server_id: 'mcp-memory' }, c)).toContain('Removed');
    expect(await mcpManageTool.execute({ action: 'remove', server_id: 'mcp-memory' }, c)).toContain('No MCP server');
    expect(BUILTIN_MCP_SERVERS.length).toBeGreaterThan(0);
  });
});
