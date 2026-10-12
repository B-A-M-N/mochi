import { describe, it, expect } from 'vitest';
import { handleMcp, type ServerState } from './mcp-server.js';

function freshState(): ServerState {
  return { cwd: process.cwd(), runtime: null };
}

describe('MCP server (editor ubiquity — stdio JSON-RPC core)', () => {
  it('initialize returns protocol version + server info', async () => {
    const r = await handleMcp({ id: 1, method: 'initialize', params: {} }, freshState());
    expect(r.error).toBeUndefined();
    expect((r.result as { protocolVersion: string }).protocolVersion).toBe('2024-11-05');
    expect((r.result as { serverInfo: { name: string } }).serverInfo.name).toBe('mochi');
  });

  it('tools/list exposes mochi_run, mochi_plan, mochi_status', async () => {
    const r = await handleMcp({ id: 2, method: 'tools/list' }, freshState());
    const tools = (r.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.map((t) => t.name)).toEqual(['mochi_run', 'mochi_plan', 'mochi_status']);
  });

  it('unknown method errors with -32601', async () => {
    const r = await handleMcp({ id: 3, method: 'bogus/method' }, freshState());
    expect(r.error?.code).toBe(-32601);
  });

  it('tools/call with unknown tool errors with -32602', async () => {
    const r = await handleMcp({ id: 4, method: 'tools/call', params: { name: 'nope', arguments: {} } }, freshState());
    expect(r.error?.code).toBe(-32602);
  });

  it('tools/call mochi_run without goal errors cleanly', async () => {
    const r = await handleMcp({ id: 5, method: 'tools/call', params: { name: 'mochi_run', arguments: {} } }, freshState());
    expect(r.error?.code).toBe(-32602);
    expect(r.error?.message).toContain('goal');
  });

  it('mochi_status works without a configured provider (lazy runtime)', async () => {
    const r = await handleMcp({ id: 6, method: 'tools/call', params: { name: 'mochi_status', arguments: {} } }, freshState());
    expect(r.error).toBeUndefined();
    expect(r.result).toBeDefined();
  });

  it('ping responds empty', async () => {
    const r = await handleMcp({ id: 7, method: 'ping' }, freshState());
    expect(r.result).toEqual({});
  });
});
