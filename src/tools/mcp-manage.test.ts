import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { mcpManageTool, searchMcpServers, addMcpServerConfig } from './mcp-manage.js';

const ctx = { cwd: '/tmp', workspace: {} as any, config: {} as any, events: {} as any, agentId: 'test' };

describe('mcp_manage tool', () => {
  it('lists all built-in MCP servers', async () => {
    const result = await mcpManageTool.execute({ action: 'list' }, ctx);
    expect(result).toContain('mcp-filesystem');
    expect(result).toContain('mcp-github');
    expect(result).toContain('mcp-memory');
    expect(result).toContain('| ID | Name | Description |');
  });

  it('returns config yaml for all servers', async () => {
    const result = await mcpManageTool.execute({ action: 'config' }, ctx);
    expect(result).toContain('mcpServers:');
    expect(result).toContain('mcp-filesystem');
    expect(result).toContain('npx');
  });

  it('returns install guide for a specific server', async () => {
    const result = await mcpManageTool.execute({ action: 'install-guide', server_id: 'mcp-github' }, ctx);
    expect(result).toContain('GitHub MCP');
    expect(result).toContain('GITHUB_TOKEN');
  });

  it('throws for unknown action', async () => {
    await expect(mcpManageTool.execute({ action: 'destroy' }, ctx)).rejects.toThrow();
  });

  it('searches built-ins by keyword (id, name, description, env)', () => {
    expect(searchMcpServers('github')[0].server.id).toBe('mcp-github');
    expect(searchMcpServers('postgres')[0].server.id).toBe('mcp-postgres');
    expect(searchMcpServers('GITHUB_TOKEN').map((h) => h.server.id)).toContain('mcp-github');
    expect(searchMcpServers('browser automation')[0].server.id).toBe('mcp-puppeteer');
    expect(searchMcpServers('')).toEqual([]);
    expect(searchMcpServers('zzz-no-such-thing')).toEqual([]);
  });

  it('adds a server to .mcp.json without clobbering siblings', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-mcp-'));
    try {
      const r1 = addMcpServerConfig(dir, 'mcp-sqlite');
      expect(r1.ok).toBe(true);
      const doc = JSON.parse(readFileSync(resolve(dir, '.mcp.json'), 'utf8')) as { mcpServers: Record<string, { command: string }> };
      expect(doc.mcpServers['mcp-sqlite'].command).toBeTruthy();
      const r2 = addMcpServerConfig(dir, 'mcp-sqlite');
      expect(r2.ok).toBe(true);
      expect(r2.alreadyPresent).toBe(true);
      const r3 = addMcpServerConfig(dir, 'mcp-fetch');
      expect(r3.ok).toBe(true);
      expect(Object.keys(JSON.parse(readFileSync(resolve(dir, '.mcp.json'), 'utf8')).mcpServers)).toContain('mcp-sqlite');
      expect(addMcpServerConfig(dir, 'nope').ok).toBe(false);
      // Tool surface: search + add through the agent tool.
      const s = await mcpManageTool.execute({ action: 'search', query: 'git' }, ctx);
      expect(s).toContain('mcp-git');
      const a = await mcpManageTool.execute({ action: 'add', server_id: 'mcp-memory', project_dir: dir }, ctx);
      expect(a).toContain('mcp-memory');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses corrupt .mcp.json instead of overwriting', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-mcp-'));
    try {
      writeFileSync(resolve(dir, '.mcp.json'), 'not json{{{');
      const r = addMcpServerConfig(dir, 'mcp-git');
      expect(r.ok).toBe(false);
      expect(readFileSync(resolve(dir, '.mcp.json'), 'utf8')).toBe('not json{{{');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
