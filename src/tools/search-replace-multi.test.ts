import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { searchReplaceMultiTool } from './search-replace-multi.js';
import type { ToolContext } from './types.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'mochi-srm-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

function ctx(): ToolContext {
  return { cwd: dir, workspace: {} as never, config: {} as never, events: { emit: () => {} } as never, agentId: 't' };
}

describe('search_replace_multi', () => {
  it('never rewrites dependency/build/VCS trees', async () => {
    mkdirSync(join(dir, 'src'), { recursive: true });
    mkdirSync(join(dir, 'venv', 'pkg'), { recursive: true });
    mkdirSync(join(dir, 'target', 'debug'), { recursive: true });
    mkdirSync(join(dir, 'node_modules', 'x'), { recursive: true });
    writeFileSync(join(dir, 'src', 'a.ts'), 'const foo = 1;\n');
    writeFileSync(join(dir, 'venv', 'pkg', 'b.py'), 'foo = 1\n');
    writeFileSync(join(dir, 'target', 'debug', 'c.rs'), 'let foo = 1;\n');
    writeFileSync(join(dir, 'node_modules', 'x', 'd.js'), 'var foo = 1;\n');

    await searchReplaceMultiTool.execute({ pattern: 'foo', replacement: 'bar' }, ctx());

    expect(readFileSync(join(dir, 'src', 'a.ts'), 'utf8')).toContain('bar');
    expect(readFileSync(join(dir, 'venv', 'pkg', 'b.py'), 'utf8')).toContain('foo');
    expect(readFileSync(join(dir, 'target', 'debug', 'c.rs'), 'utf8')).toContain('foo');
    expect(readFileSync(join(dir, 'node_modules', 'x', 'd.js'), 'utf8')).toContain('foo');
  });

  it('replaces EVERY occurrence even when the model omits the global flag', async () => {
    writeFileSync(join(dir, 'a.ts'), 'foo foo foo\n');
    await searchReplaceMultiTool.execute({ pattern: 'foo', replacement: 'bar', flags: 'i' }, ctx());
    expect(readFileSync(join(dir, 'a.ts'), 'utf8')).toBe('bar bar bar\n');
  });
});
