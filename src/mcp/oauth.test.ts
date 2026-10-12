import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { getOAuthToken, oauthHeaders } from './oauth.js';

let server: import('node:http').Server | undefined;
let tokenUrl = '';
let mcpUrl = '';
let tokenHits = 0;
const VALID = 'tok-abc-123';

async function startServers() {
  const http = await import('node:http');
  // OAuth token endpoint: client_credentials -> short-lived token + refresh.
  const oauth = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      tokenHits++;
      const params = new URLSearchParams(body);
      if (params.get('client_id') !== 'my-id' || params.get('client_secret') !== 'my-secret') {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_client' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ access_token: VALID, expires_in: 3600, refresh_token: 'refresh-xyz' }));
    });
  });
  await new Promise<void>((r) => oauth.listen(0, '127.0.0.1', () => r()));
  tokenUrl = `http://127.0.0.1:${(oauth.address() as { port: number }).port}/token`;
  // MCP server: requires the bearer token, serves tools/list.
  const mcp = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (req.headers.authorization !== `Bearer ${VALID}`) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 0, error: { code: -32000, message: 'unauthorized' } }));
        return;
      }
      const msg = JSON.parse(body);
      const reply = (result: unknown) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
      };
      if (msg.method === 'initialize') reply({ protocolVersion: '2024-11-05', capabilities: {}, serverInfo: {} });
      else if (msg.method === 'tools/list') reply({ tools: [{ name: 'ping', description: 'Ping', inputSchema: { type: 'object' } }] });
      else reply({});
    });
  });
  await new Promise<void>((r) => mcp.listen(0, '127.0.0.1', () => r()));
  mcpUrl = `http://127.0.0.1:${(mcp.address() as { port: number }).port}/mcp`;
  const prev = server;
  server = oauth;
  (server as unknown as { __mcp?: unknown }).__mcp = mcp;
  void prev;
}

afterEach(async () => {
  if (server) {
    const mcp = (server as unknown as { __mcp?: import('node:http').Server }).__mcp;
    await new Promise<void>((r) => server!.close(() => r()));
    if (mcp) await new Promise<void>((r) => mcp.close(() => r()));
    server = undefined;
  }
});

const cfg = () => ({
  tokenUrl,
  clientId: 'my-id',
  clientSecret: 'my-secret',
});

describe('MCP OAuth (pre-registered clients)', () => {
  it('mints, caches, and reuses bearer tokens', async () => {
    await startServers();
    const { mkdtempSync: mk } = await import('node:fs');
    const dir = mk(resolve(tmpdir(), 'mochi-oauth-'));
    try {
      tokenHits = 0;
      const t1 = await getOAuthToken('srv', cfg(), dir);
      expect(t1).toBe(VALID);
      expect(tokenHits).toBe(1);
      const t2 = await getOAuthToken('srv', cfg(), dir);
      expect(t2).toBe(VALID);
      expect(tokenHits).toBe(1); // cached: no second exchange
      const h = await oauthHeaders('srv', cfg(), dir);
      expect(h).toEqual({ authorization: `Bearer ${VALID}` });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects bad client credentials with a readable error', async () => {
    await startServers();
    const { mkdtempSync: mk } = await import('node:fs');
    const dir = mk(resolve(tmpdir(), 'mochi-oauth-'));
    try {
      await expect(getOAuthToken('srv', { ...cfg(), clientSecret: 'wrong' }, dir)).rejects.toThrow(/invalid_client|HTTP 401/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('drives an authenticated MCP tool call end-to-end', async () => {
    await startServers();
    const { mkdtempSync: mk } = await import('node:fs');
    const dir = mk(resolve(tmpdir(), 'mochi-oauth-'));
    try {
      const { McpClient } = await import('./index.js');
      const client = McpClient.forConfig(
        { url: mcpUrl, headers: await oauthHeaders('srv', cfg(), dir) },
        'auth-mcp',
      );
      try {
        expect((await client.listTools()).map((t) => t.name)).toEqual(['ping']);
      } finally {
        client.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns empty headers without oauth config', async () => {
    expect(await oauthHeaders('srv', undefined)).toEqual({});
    expect(await oauthHeaders('srv', { tokenUrl: '', clientId: '' })).toEqual({});
  });
});
