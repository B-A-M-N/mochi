// Forces the pure-TS fallbackSearch path of tools/search.ts: native search
// returns null and the rg spawn fails, so execute() must walk the tree
// itself. Covers walkFiles + its budget/yield guards, the fallback glob
// filter, fileOutline decl hints, escapeRegex, absolute-path rendering when
// searching a subdirectory, and the query-cache LRU eviction.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// Must be set before search.ts is loaded: the walk budget is module-level.
process.env.MOCHI_SEARCH_WALK_MAX_FILES = '250';

vi.mock('../native/core.js', () => ({ nativeSearchDir: () => null }));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const spawn = () => {
    const handlers: Record<string, (arg?: unknown) => void> = {};
    return {
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      on: (ev: string, cb: (arg?: unknown) => void) => { handlers[ev] = cb; },
      kill: () => {},
      // Simulate `spawn rg` failing (ENOENT) asynchronously.
      __fail: () => setImmediate(() => handlers.error?.(new Error('spawn rg ENOENT'))),
    } as unknown as ReturnType<typeof actual.spawn>;
  };
  const wrapped: typeof actual.spawn = ((...args: Parameters<typeof actual.spawn>) => {
    const proc = spawn() as ReturnType<typeof actual.spawn> & { __fail: () => void };
    proc.__fail();
    return proc;
  }) as typeof actual.spawn;
  return { ...actual, spawn: wrapped };
});

const { searchTool } = await import('./search.js');
import type { ToolContext } from './types.js';

let dir: string;
let ctx: ToolContext;

beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-fallback-'));
  mkdirSync(resolve(dir, 'src'), { recursive: true });
  mkdirSync(resolve(dir, 'sub'), { recursive: true });
  writeFileSync(resolve(dir, 'src', 'alpha.ts'), 'export function alpha() {\n  // literal needle here\n  return 1;\n}\n');
  writeFileSync(resolve(dir, 'src', 'beta.js'), 'const needle = "needle";\n');
  writeFileSync(resolve(dir, 'src', 'plus.ts'), 'const weird = "a+b(";\n');
  writeFileSync(resolve(dir, 'notes.txt'), 'needle in a haystack\n');
  writeFileSync(resolve(dir, 'sub', 'nested.ts'), 'needle deep\n');
  ctx = { cwd: dir, workspace: {} as never, config: {} as never, events: {} as never, agentId: 't' };
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const run = (args: Record<string, unknown>, c: ToolContext = ctx) =>
  searchTool.execute(args, c).then(String);

describe('search fallback walk', () => {
  it('finds literals with line numbers and declaration outlines', async () => {
    const out = await run({ query: 'needle' });
    expect(out).toContain('src/alpha.ts');
    expect(out).toContain('2:'); // `// literal needle here`
    expect(out).toContain('decl:'); // fileOutline hint
    expect(out).toContain('function alpha');
  });

  it('treats the query as a literal, not a regex', async () => {
    const out = await run({ query: 'a+b(' });
    expect(out).toContain('src/plus.ts');
  });

  it('applies the fallback glob filter', async () => {
    const out = await run({ query: 'needle', glob: '*.js' });
    expect(out).toContain('src/beta.js');
    expect(out).not.toContain('src/alpha.ts');
    expect(out).not.toContain('notes.txt');
  });

  it('renders absolute paths when searching a subdirectory', async () => {
    const out = await run({ query: 'needle deep', path: 'sub' });
    expect(out).toContain(resolve(dir, 'sub', 'nested.ts'));
  });

  it('caps the tree walk and says so when nothing matched', async () => {
    const big = mkdtempSync(resolve(tmpdir(), 'mochi-bigwalk-'));
    try {
      for (let i = 0; i < 300; i++) writeFileSync(resolve(big, `f${i}.txt`), `file ${i}\n`);
      const bctx = { ...ctx, cwd: big };
      const out = await run({ query: 'absent_token_zzz' }, bctx);
      expect(out).toContain('[walk capped at 250 files');
    } finally {
      rmSync(big, { recursive: true, force: true });
    }
  }, 60_000);

  it('evicts the least-recently-used query once the cache is full', async () => {
    // 65 unique matching queries: the 65th put evicts the first entry.
    const zebra = mkdtempSync(resolve(tmpdir(), 'mochi-lru-'));
    try {
      for (let i = 1; i <= 65; i++) writeFileSync(resolve(zebra, `z${i}.txt`), `zebra${i} here\n`);
      const zctx = { ...ctx, cwd: zebra };
      for (let i = 1; i <= 65; i++) await run({ query: `zebra${i}` }, zctx);
      // zebra1 was evicted -> fresh search, no cache-hit marker.
      expect(await run({ query: 'zebra1' }, zctx)).not.toContain('[query cache hit]');
      // The newest entry survived -> marker present.
      expect(await run({ query: 'zebra65' }, zctx)).toContain('[query cache hit]');
    } finally {
      rmSync(zebra, { recursive: true, force: true });
    }
  }, 120_000);

  it('throws on a missing query', async () => {
    await expect(run({ query: '' })).rejects.toThrow(/No query provided/);
  });
});
