import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpClient, schemaToParameters, type McpServerConfig } from './index.js';

// Minimal MCP stdio server that supports initialize, tools/list and tools/call
// for one tool `echo`. Written to a temp file and spawned with the current
// node, so the test exercises the real subprocess transport.
const SERVER = `
const rl = require('node:readline').createInterface({ input: process.stdin });
let initialized = false;
rl.on('line', (line) => {
  if (!line.trim()) return;
  let body; try { body = JSON.parse(line); } catch { return; }
  if (body.method === 'initialize') {
    initialized = true;
    process.stdout.write(JSON.stringify({ jsonrpc:'2.0', id: body.id, result: { protocolVersion:'2024-11-05', capabilities:{tools:{}}, serverInfo:{name:'mini',version:'1'} } }) + '\\n');
  } else if (body.method === 'notifications/initialized') {
    return; // no reply
  } else if (body.method === 'tools/list') {
    process.stdout.write(JSON.stringify({ jsonrpc:'2.0', id: body.id, result: { tools: [{ name:'uppercase', description:'Uppercase a string', inputSchema:{ type:'object', properties:{ text:{ type:'string' } }, required:['text'] } }] } }) + '\\n');
  } else if (body.method === 'tools/call') {
    const args = body.params.arguments || {};
    const text = String(args.text || '').toUpperCase();
    process.stdout.write(JSON.stringify({ jsonrpc:'2.0', id: body.id, result:{ content:[{type:'text', text}] } }) + '\\n');
  }
});
setTimeout(() => {}, 60_000);
`;

describe('McpClient (stdio, real subprocess)', () => {
  let dir: string;
  let serverPath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'mochi-mcp-'));
    serverPath = join(dir, 'mcp-server.cjs');
    writeFileSync(serverPath, SERVER);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('handshakes, lists tools, and calls a tool', async () => {
    const cfg: McpServerConfig = { command: process.execPath, args: [serverPath] };
    const client = new McpClient(cfg, 'mini');
    try {
      await client.initialize();
      const tools = await client.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('uppercase');

      const out = await client.callTool('uppercase', { text: 'hello world' });
      expect(out).toBe('HELLO WORLD');
    } finally {
      client.close();
    }
  });

  it('maps an MCP input schema to Mochi parameters', () => {
    const params = schemaToParameters({
      type: 'object',
      properties: { text: { type: 'string' }, count: { type: 'integer' } },
      required: ['text'],
    });
    expect(params).toHaveLength(2);
    expect(params[0].name).toBe('text');
    expect(params[0].required).toBe(true);
    expect(params[1].type).toBe('integer');
  });
});
describe('McpClient (HTTP, mock server)', () => {
  let server: import('node:http').Server;
  let url: string;

  beforeAll(async () => {
    const http = await import('node:http');
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let msg: { id?: number; method?: string; params?: { arguments?: { text?: string } } };
        try {
          msg = JSON.parse(body);
        } catch {
          res.writeHead(400);
          res.end();
          return;
        }
        if (msg.method === 'notifications/initialized') {
          res.writeHead(202);
          res.end();
          return;
        }
        const reply = (result: unknown) => {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
        };
        if (msg.method === 'initialize') {
          reply({ protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mini-http', version: '1' } });
        } else if (msg.method === 'tools/list') {
          reply({ tools: [{ name: 'uppercase', description: 'Uppercase a string', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }] });
        } else if (msg.method === 'tools/call') {
          const text = String(msg.params?.arguments?.text ?? '').toUpperCase();
          reply({ content: [{ type: 'text', text }] });
        } else {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } }));
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const addr = server.address() as { port: number };
    url = `http://127.0.0.1:${addr.port}/mcp`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  it('handshakes, lists tools, and calls a tool over HTTP', async () => {
    const client = McpClient.forConfig({ url }, 'mini-http');
    try {
      await client.initialize();
      const tools = await client.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('uppercase');
      expect(await client.callTool('uppercase', { text: 'hello world' })).toBe('HELLO WORLD');
    } finally {
      client.close();
    }
  });

  it('forConfig picks stdio when no url is set', () => {
    const client = McpClient.forConfig({ command: 'true' }, 'x');
    try {
      expect(client).toBeInstanceOf(McpClient);
    } finally {
      client.close();
    }
  });

  it('surfaces HTTP errors instead of hanging', async () => {
    const client = McpClient.forConfig({ url: 'http://127.0.0.1:1/nope' }, 'dead');
    try {
      await expect(client.listTools()).rejects.toThrow();
    } finally {
      client.close();
    }
  }, 60_000);
});
