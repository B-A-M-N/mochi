// B5 regression: every filesystem-mutating tool must bump the process-wide
// mutation fence (fs-signal markMutation). Generation-keyed caches (search,
// inspect) serve stale results indefinitely when a mutation skips the fence —
// the fence's own contract (fs-signal.ts) says every mutation bumps it.
// write/edit/delete/replace-symbol/patch already bump; these were missing:
// regex_replace, search_replace_multi, move_file, copy_file, notebook, shell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { mutationGeneration } from './fs-signal.js';
import type { ToolContext } from './types.js';

let dir: string;
beforeAll(() => { dir = mkdtempSync(resolve(tmpdir(), 'mochi-fence-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function ctx(): ToolContext {
  return {
    cwd: dir,
    workspace: {} as any,
    config: { safety: { mode: 'auto', commandTimeoutSeconds: 10, sandbox: 'off' } } as any,
    events: { emit: () => {} } as any,
    agentId: 'fence',
  };
}

describe('mutation fence coverage (B5)', () => {
  it('regex_replace bumps the fence when it writes', async () => {
    const { regexReplaceTool } = await import('./regex-replace.js');
    const p = resolve(dir, 'rx.txt');
    writeFileSync(p, 'hello world\n');
    const before = mutationGeneration();
    const out = String(await regexReplaceTool.execute({ path: 'rx.txt', pattern: 'world', replacement: 'mochi', flags: 'g' }, ctx()));
    expect(out).toContain('Replaced 1');
    expect(mutationGeneration()).toBeGreaterThan(before);
  });

  it('search_replace_multi bumps the fence when it writes files', async () => {
    const { searchReplaceMultiTool } = await import('./search-replace-multi.js');
    writeFileSync(resolve(dir, 'multi_a.txt'), 'alpha beta\n');
    writeFileSync(resolve(dir, 'multi_b.txt'), 'alpha gamma\n');
    const before = mutationGeneration();
    const out = String(await searchReplaceMultiTool.execute({ pattern: 'alpha', replacement: 'omega', extensions: ['.txt'] }, ctx()));
    expect(out).toContain('Replaced');
    expect(mutationGeneration()).toBeGreaterThan(before);
  });

  it('move_file bumps the fence', async () => {
    const { moveFileTool } = await import('./file-ops.js');
    writeFileSync(resolve(dir, 'mv_src.txt'), 'x');
    const before = mutationGeneration();
    const out = String(await moveFileTool.execute({ source: 'mv_src.txt', destination: 'mv_dst.txt' }, ctx()));
    expect(out).toContain('[OK] Moved');
    expect(mutationGeneration()).toBeGreaterThan(before);
  });

  it('copy_file bumps the fence', async () => {
    const { copyFileTool } = await import('./file-ops.js');
    writeFileSync(resolve(dir, 'cp_src.txt'), 'x');
    const before = mutationGeneration();
    const out = String(await copyFileTool.execute({ source: 'cp_src.txt', destination: 'cp_dst.txt' }, ctx()));
    expect(out).toContain('[OK] Copied');
    expect(mutationGeneration()).toBeGreaterThan(before);
  });

  it('notebook bumps the fence when it saves', async () => {
    const { notebookTool } = await import('./notebook.js');
    // Notebook edits require a valid nbformat-4 file to edit.
    const nbPath = resolve(dir, 'nb.ipynb');
    writeFileSync(nbPath, JSON.stringify({
      cells: [{ cell_type: 'code', source: ['print(0)\n'], metadata: {}, outputs: [], execution_count: null }],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    }));
    const before = mutationGeneration();
    const out = String(await notebookTool.execute({ path: 'nb.ipynb', action: 'edit', index: 0, source: 'print(1)' }, ctx()));
    expect(out).not.toContain('Error');
    expect(mutationGeneration()).toBeGreaterThan(before);
  });

  it('shell bumps the fence after running a command that writes', async () => {
    const { shellTool } = await import('./shell.js');
    const before = mutationGeneration();
    const out = String(await shellTool.execute({ command: 'touch fenced_by_shell.txt' }, ctx()));
    expect(out).toContain('exit_code: 0');
    expect(mutationGeneration()).toBeGreaterThan(before);
  });
});
