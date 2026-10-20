// Client-side MCP coverage (src/tools/mcp.ts): stdio + streamable-HTTP
// transports, tool wrapping/permissions/param mapping, error propagation,
// resources/list inventory, and parseMcpServers config normalization.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Tool, ToolContext } from './types.js';
import { parseMcpServers, loadMcpTools, closeMcpConnections } from './mcp.js';

let dir: string;
let serverScript: string;

// ── fake stdio MCP server ──────────────────────────────────────────────────
const SERVER_SRC = `
const readline = require('node:readline');
const profile = process.argv[2] || 'full';
const TOOLS = {
  full: [
    { name: 'echo', description: 'Echo text back', inputSchema: { type: 'object', properties: {
        text: { type: 'string', description: 'text to echo' },
        count: { type: 'number' }, flag: { type: 'boolean' },
        items: { type: 'array' }, obj: { type: 'object' },
        nodesc: { type: 'string' } }, required: ['text'] },
      annotations: { readOnlyHint: true } },
    { name: 'boom', description: 'Always errors', inputSchema: { type: 'object', properties: {} } },
    { name: 'blob', description: 'Non-text content', inputSchema: { type: 'object', properties: {} } },
    { name: 'jsonish', description: 'Result without content array', inputSchema: { type: 'object', properties: {} } },
    { name: 'ghost', description: 'Listed but unhandled' },
  ],
  res: [ { name: 'noop', description: 'n', inputSchema: { type: 'object', properties: {} } } ],
  empty: [],
  strict: [ { name: 'ping', description: 'p', inputSchema: { type: 'object', properties: {} } } ],
};
const RESOURCES = { res: [ { uri: 'file:///a', name: 'A', mimeType: 'text/plain' } ] };
const rl = readline.createInterface({ input: process.stdin });
const send = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return; }
  // Profile 'strict' is SPEC-COMPLIANT: notifications/initialized is a
  // notification and is never answered — not even when a misbehaving client
  // sends it with an id (which is what this client used to do, stalling every
  // stdio connect by 5s). Every other profile (incorrectly) replies to the
  // notification too, which masked that client bug.
  if (profile === 'strict' && msg.method === 'notifications/initialized') return;
  const ok = (result) => send({ jsonrpc: '2.0', id: msg.id, result });
  const err = (m) => send({ jsonrpc: '2.0', id: msg.id, error: { message: m } });
  switch (msg.method) {
    case 'initialize': ok({ protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fake', version: '1' } }); break;
    case 'notifications/initialized': ok({}); break;
    case 'tools/list': ok({ tools: TOOLS[profile] || [] }); break;
    case 'resources/list': ok({ resources: RESOURCES[profile] || [] }); break;
    case 'tools/call': {
      const name = msg.params && msg.params.name;
      const args = (msg.params && msg.params.arguments) || {};
      if (name === 'echo') ok({ content: [{ type: 'text', text: 'echo:' + args.text + ':' + (process.env.MCP_MARKER || 'none') }] });
      else if (name === 'boom') ok({ isError: true, content: [{ type: 'text', text: 'exploded' }] });
      else if (name === 'blob') ok({ content: [{ type: 'image', data: 'x' }] });
      else if (name === 'jsonish') ok({ some: 'json' });
      else err('unknown tool ' + name);
      break;
    }
    default: ok({});
  }
});
`;

beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-mcp-client-'));
  serverScript = resolve(dir, 'fake-mcp-server.cjs');
  writeFileSync(serverScript, SERVER_SRC);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const ctx = { cwd: dir, workspace: {} as never, config: {} as never, events: {} as never, agentId: 't' } as ToolContext;
const stdioCfg = (name: string, profile: string, extra: Record<string, unknown> = {}) => ({
  name,
  command: process.execPath,
  args: [serverScript, profile],
  ...extra,
});
const find = (tools: Tool[], name: string): Tool => {
  const t = tools.find((x) => x.def.name === name);
  if (!t) throw new Error(`tool ${name} not found in [${tools.map((x) => x.def.name).join(', ')}]`);
  return t;
};

describe('parseMcpServers', () => {
  it('normalizes command and url forms, skipping invalid entries', () => {
    expect(parseMcpServers(undefined)).toEqual([]);
    expect(parseMcpServers({})).toEqual([]);
    expect(parseMcpServers({ mcpServers: {} })).toEqual([]);
    const out = parseMcpServers({
      mcpServers: {
        a: { command: 'node', args: ['x.js'], env: { K: 'v' } },
        b: { url: 'https://h/mcp', headers: { a: 'b' } },
        c: { command: 5 },
        d: null,
        e: { args: 'nope' },
        f: { command: 'node', args: 'oops' },
      },
    });
    expect(out).toEqual([
      { name: 'a', command: 'node', args: ['x.js'], env: { K: 'v' } },
      { name: 'b', url: 'https://h/mcp', headers: { a: 'b' } },
      { name: 'f', command: 'node', args: [], env: undefined },
    ]);
  });
});

describe('stdio transport', () => {
  it('connects, wraps tools, maps params/permissions, and executes', async () => {
    const logs: string[] = [];
    const { tools, connections } = await loadMcpTools([stdioCfg('full', 'full')], (m) => logs.push(m));
    try {
      expect(logs.join('\n')).toContain('[mcp] connected full: 5 tool(s)');

      const echo = find(tools, 'mcp_full_echo');
      expect(echo.def.permission).toBe('read'); // annotations.readOnlyHint
      expect(echo.def.description).toContain('[mcp:full]');
      const params = Object.fromEntries(echo.def.parameters.map((p) => [p.name, p]));
      expect(params.text).toMatchObject({ type: 'string', required: true, description: 'text to echo' });
      expect(params.count.type).toBe('number');
      expect(params.flag.type).toBe('boolean');
      expect(params.items.type).toBe('string'); // array passed as JSON text
      expect(params.obj.type).toBe('string'); // object passed as JSON text
      expect(params.nodesc).toMatchObject({ description: '', required: false });

      const boom = find(tools, 'mcp_full_boom');
      expect(boom.def.permission).toBe('network'); // mutating default

      expect(await echo.execute({ text: 'hi' }, ctx)).toBe('echo:hi:none');
    } finally {
      closeMcpConnections(connections);
    }
  });

  it('handshakes with a spec-compliant server that never answers notifications', async () => {
    // notifications/initialized is a JSON-RPC notification: compliant servers
    // never reply. Awaiting a response to it stalled every stdio connect for
    // the full 5s timeout and then failed the connect ("timed out after
    // 5000ms" → server skipped). The connect must complete promptly instead.
    const logs: string[] = [];
    const t0 = Date.now();
    const { tools, connections } = await loadMcpTools([stdioCfg('strict', 'strict')], (m) => logs.push(m));
    const elapsed = Date.now() - t0;
    try {
      expect(elapsed).toBeLessThan(4000); // old bug: >=5000ms then skip
      expect(logs.join('\n')).toContain('[mcp] connected strict: 1 tool(s)');
      expect(find(tools, 'mcp_strict_ping').def.name).toBe('mcp_strict_ping');
    } finally {
      closeMcpConnections(connections);
    }
  }, 20_000);

  it('merges server env into the child process environment', async () => {
    const { tools, connections } = await loadMcpTools([stdioCfg('envd', 'full', { env: { MCP_MARKER: 'zz' } })]);
    try {
      expect(await find(tools, 'mcp_envd_echo').execute({ text: 'a' }, ctx)).toBe('echo:a:zz');
    } finally {
      closeMcpConnections(connections);
    }
  });

  it('propagates isError, non-text content, JSON fallbacks, and RPC errors', async () => {
    const { tools, connections } = await loadMcpTools([stdioCfg('full', 'full')]);
    try {
      await expect(find(tools, 'mcp_full_boom').execute({}, ctx)).rejects.toThrow(/mcp full\.boom: exploded/);
      expect(await find(tools, 'mcp_full_blob').execute({}, ctx)).toBe('[image content]');
      expect(await find(tools, 'mcp_full_jsonish').execute({}, ctx)).toBe('{"some":"json"}');
      await expect(find(tools, 'mcp_full_ghost').execute({}, ctx)).rejects.toThrow(/unknown tool ghost/);
    } finally {
      closeMcpConnections(connections);
    }
  });

  it('exposes resources/list as an inventory tool', async () => {
    const res = await loadMcpTools([stdioCfg('res', 'res')]);
    try {
      const list = find(res.tools, 'mcp_res_list_resources');
      expect(list.def.permission).toBe('read');
      expect(await list.execute({}, ctx)).toContain('file:///a  A  text/plain');
    } finally {
      closeMcpConnections(res.connections);
    }
    const full = await loadMcpTools([stdioCfg('full', 'full')]);
    try {
      expect(await find(full.tools, 'mcp_full_list_resources').execute({}, ctx))
        .toBe('No resources exposed by this server.');
    } finally {
      closeMcpConnections(full.connections);
    }
  });

  it('skips servers that fail to spawn or handshake, keeping the rest', async () => {
    const logs: string[] = [];
    const { tools, connections } = await loadMcpTools([
      { name: 'broken', command: '/definitely/not/a/binary/mochi' },
      { name: 'exits', command: process.execPath, args: ['-e', 'process.exit(3)'] },
      stdioCfg('full', 'full'),
    ], (m) => logs.push(m));
    try {
      expect(connections).toHaveLength(1);
      expect(tools.length).toBeGreaterThan(0);
      expect(logs.join('\n')).toMatch(/server broken unavailable, skipping/);
      expect(logs.join('\n')).toMatch(/server exits unavailable, skipping/);
    } finally {
      closeMcpConnections(connections);
    }
  }, 60_000);

  it('closeMcpConnections tolerates repeats', async () => {
    const { connections } = await loadMcpTools([stdioCfg('full', 'full')]);
    closeMcpConnections(connections);
    expect(() => closeMcpConnections(connections)).not.toThrow();
  });
});

describe('streamable HTTP transport', () => {
  let srv: Server;
  let port = 0;
  let lastHeaders: Record<string, string | string[] | undefined> = {};

  beforeAll(async () => {
    srv = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        let msg: Record<string, any> = {};
        try { msg = JSON.parse(body || '{}'); } catch { /* noop */ }
        const id = msg.id;
        lastHeaders = req.headers;
        const json = (obj: unknown) => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(obj));
        };
        const sse = (payload: string) => {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.end(payload);
        };
        const tool = msg.params && msg.params.name;
        if (msg.method === 'tools/list') {
          json({ jsonrpc: '2.0', id, result: { tools: ['sse_tool', 'sse_err', 'junk_stream', 'http500', 'badnews']
            .map((name) => ({ name, description: name, inputSchema: { type: 'object', properties: {} } })) } });
        } else if (msg.method === 'resources/list') {
          json({ jsonrpc: '2.0', id, result: { resources: [] } });
        } else if (msg.method === 'tools/call') {
          if (tool === 'sse_tool') sse(`data: ${JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'from-sse' }] } })}\n\ndata: [DONE]\n\n`);
          else if (tool === 'sse_err') sse(`data: ${JSON.stringify({ jsonrpc: '2.0', id, error: { message: 'sse error' } })}\n\n`);
          else if (tool === 'junk_stream') sse('data: not-json\n\ndata: {"jsonrpc":"2.0","id":99999,"result":{}}\n\n');
          else if (tool === 'http500') { res.writeHead(500, { 'content-type': 'application/json' }); res.end('{}'); }
          else if (tool === 'badnews') json({ jsonrpc: '2.0', id, error: { message: 'bad news' } });
          else json({ jsonrpc: '2.0', id, error: { message: `unknown ${tool}` } });
        } else {
          // initialize + notifications/initialized
          json({ jsonrpc: '2.0', id, result: {} });
        }
      });
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    port = (srv.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => srv.close(() => r())));

  it('completes the handshake and parses JSON, SSE, and error responses', async () => {
    const logs: string[] = [];
    const { tools, connections } = await loadMcpTools(
      [{ name: 'httpx', url: `http://127.0.0.1:${port}/mcp`, headers: { 'x-probe': '1' } }],
      (m) => logs.push(m),
    );
    try {
      expect(logs.join('\n')).toContain('[mcp] connected httpx');
      expect(lastHeaders['x-probe']).toBe('1');
      expect(lastHeaders['content-type']).toBe('application/json');
      expect(lastHeaders['mcp-protocol-version']).toBe('2025-03-26');

      // SSE happy path
      expect(await find(tools, 'mcp_httpx_sse_tool').execute({}, ctx)).toBe('from-sse');
      // SSE carrying an error event
      await expect(find(tools, 'mcp_httpx_sse_err').execute({}, ctx)).rejects.toThrow(/sse error/);
      // SSE with junk + no matching id -> no result
      await expect(find(tools, 'mcp_httpx_junk_stream').execute({}, ctx)).rejects.toThrow(/SSE stream carried no result/);
      // plain HTTP 500
      await expect(find(tools, 'mcp_httpx_http500').execute({}, ctx)).rejects.toThrow(/HTTP 500/);
      // JSON-RPC error payload
      await expect(find(tools, 'mcp_httpx_badnews').execute({}, ctx)).rejects.toThrow(/bad news/);
      // resources/list empty inventory
      expect(await find(tools, 'mcp_httpx_list_resources').execute({}, ctx))
        .toBe('No resources exposed by this server.');
    } finally {
      closeMcpConnections(connections);
    }
  }, 60_000);
});
