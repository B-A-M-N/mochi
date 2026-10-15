import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { EventBus } from '../events.js';
import { Workspace } from '../workspace.js';
import { treeTool } from './tree.js';

function makeCtx(cwd: string) {
  return { cwd, workspace: new Workspace(cwd, '.mochi'), events: new EventBus(), config: { permissions: { read: true }, safety: { mode: 'auto' } } as any, agentId: 'test' };
}

describe('treeTool', () => {
  it('lists top-level files and subdirectories', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-tree-'));
    writeFileSync(resolve(dir, 'README.md'), '# hello');
    mkdirSync(resolve(dir, 'src'));
    writeFileSync(resolve(dir, 'src', 'index.ts'), 'export {}');
    const ctx = makeCtx(dir);
    const result = await treeTool.execute({}, ctx);
    expect(result).toContain('README.md');
    expect(result).toContain('src/');
    expect(result).toContain('index.ts');
  });

  it('respects depth limit', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-tree-'));
    mkdirSync(resolve(dir, 'a'));
    mkdirSync(resolve(dir, 'a', 'b'));
    mkdirSync(resolve(dir, 'a', 'b', 'c'));
    writeFileSync(resolve(dir, 'a', 'b', 'c', 'deep.txt'), 'deep');
    const ctx = makeCtx(dir);
    // depth=2 should not show deep.txt
    const result = await treeTool.execute({ depth: 2 }, ctx);
    expect(result).not.toContain('deep.txt');
  });

  it('clips output for a very wide directory (no context bomb)', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-tree-wide-'));
    const name = 'file-with-a-fairly-long-name-'.padEnd(48, 'x');
    for (let i = 0; i < 2_000; i++) writeFileSync(resolve(dir, `${name}${i}.ts`), '');
    const ctx = makeCtx(dir);
    const result = await treeTool.execute({ depth: 1 }, ctx);
    expect(result).toContain('[mochi: elided');
    expect(result.length).toBeLessThan(80_000);
  });
});
