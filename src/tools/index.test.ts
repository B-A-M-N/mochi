import { describe, it, expect } from 'vitest';
import { buildTools, trimHeavyTools, trimToReadTier, CHAT_TOOL_NAMES, loadToolsTool, HEAVY_TOOL_NAMES, ALL_TOOLS_MAP, TOOL_ALIASES } from './index.js';
import type { MochiConfig } from '../types.js';

const cfg = { projectDir: '/tmp/mch91-test' } as unknown as MochiConfig;

describe('MCH-91 task-adaptive tool advertising', () => {
  it('default advertised set includes heavy tools until trimmed', () => {
    const tools = buildTools(cfg);
    expect(tools.has('browser')).toBe(true);
    expect(tools.has('db_inspect')).toBe(true);
    expect(tools.has('load_tools')).toBe(true);
  });

  it('trimHeavyTools removes heavy tools for plain coding task text', () => {
    const tools = buildTools(cfg);
    const before = tools.size;
    const trimmed = trimHeavyTools(tools, 'Create add.js exporting add(a,b)=a+b. Create add.test.js printing add(2,3).');
    expect(trimmed).toBeGreaterThan(0);
    expect(tools.has('browser')).toBe(false);
    expect(tools.has('db_inspect')).toBe(false);
    // core editing tools survive
    expect(tools.has('read')).toBe(true);
    expect(tools.has('write')).toBe(true);
    expect(tools.has('edit')).toBe(true);
    expect(tools.has('shell')).toBe(true);
    expect(tools.size).toBe(before - trimmed);
    expect(tools.has('load_tools')).toBe(true);
  });

  it('trimHeavyTools is a no-op when task text signals heavy needs', () => {
    const tools = buildTools(cfg);
    const trimmed = trimHeavyTools(tools, 'Open the browser and take a screenshot of the page, then fix the SQL in the database migration.');
    expect(trimmed).toBe(0);
    expect(tools.has('browser')).toBe(true);
  });

  it('load_tools restores a trimmed tool and resolves aliases', async () => {
    const tools = buildTools(cfg);
    trimHeavyTools(tools, 'fix the failing test');
    expect(tools.has('lint')).toBe(false);
    const tool = loadToolsTool(() => tools);
    const out = await tool.execute({ names: ['lint', 'read_file'] }); // read_file is an alias of read
    expect(String(out)).toContain('Loaded: lint, read');
    expect(tools.has('lint')).toBe(true);
    expect(tools.has('read')).toBe(true);
    expect(String(out)).not.toContain('Unknown');
  });

  it('load_tools reports unknown names without throwing', async () => {
    const tools = buildTools(cfg);
    const tool = loadToolsTool(() => tools);
    const out = await tool.execute({ names: ['nonexistent_tool'] });
    expect(String(out)).toContain('Unknown tools');
  });

  it('heavy set is small and every name is a real tool', () => {
    expect(HEAVY_TOOL_NAMES.size).toBeGreaterThan(5);
    for (const name of HEAVY_TOOL_NAMES) {
      expect(ALL_TOOLS_MAP.has(name)).toBe(true);
    }
  });

  it('chat tier keeps search (tool name, not the grep alias)', () => {
    // Regression: the chat set once listed 'grep', which never matches a map
    // key — search silently vanished from every chat turn.
    expect(CHAT_TOOL_NAMES.has('search')).toBe(true);
    expect(CHAT_TOOL_NAMES.has('grep')).toBe(false);
    const tools = buildTools(cfg);
    const kept = [...tools.keys()].filter((n) => CHAT_TOOL_NAMES.has(n));
    expect(kept).toContain('search');
    expect(kept).toContain('read');
    expect(kept).not.toContain('write');
    expect(kept).not.toContain('shell');
  });

  it('read tier advertises read-only essentials for research/plan tasks', () => {
    const tools = buildTools(cfg);
    const trimmed = trimToReadTier(tools, 'Research how auth flows through the codebase');
    expect(trimmed).toBeGreaterThan(0);
    for (const name of ['read', 'search', 'glob', 'outline', 'inspect', 'fetch', 'skill', 'think', 'ask_question', 'load_tools']) {
      expect(tools.has(name), `${name} kept`).toBe(true);
    }
    for (const name of ['write', 'edit', 'shell', 'git', 'delete', 'subagent']) {
      expect(tools.has(name), `${name} deferred`).toBe(false);
    }
    expect(tools.has('load_tools')).toBe(true); // escape hatch survives
  });

  it('read tier is a no-op when task text signals heavier needs', () => {
    const tools = buildTools(cfg);
    expect(trimToReadTier(tools, 'Research browser automation with screenshots')).toBe(0);
    expect(tools.has('browser')).toBe(true);
  });

  it('read tier keeps review_pr (reviews are read-shaped analysis)', () => {
    const tools = buildTools(cfg);
    trimToReadTier(tools, 'Review my PR for correctness');
    expect(tools.has('review_pr')).toBe(true);
    expect(tools.has('read')).toBe(true);
    expect(tools.has('write')).toBe(false);
  });
});
