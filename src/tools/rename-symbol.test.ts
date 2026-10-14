import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { renameSymbolTool } from './rename-symbol.js';
import type { ToolContext } from './types.js';

describe('rename_symbol tool', () => {
  let dir: string;
  let ctx: ToolContext;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'mochi-rename-'));
    mkdirSync(resolve(dir, 'src'), { recursive: true });
    writeFileSync(resolve(dir, 'src', 'calc.ts'), 'export function calculateTotal(a: number, b: number): number {\n  return a + b;\n}\n');
    writeFileSync(resolve(dir, 'src', 'main.ts'), 'import { calculateTotal } from "./calc.js";\nconst sum = calculateTotal(1, 2);\n');
    ctx = { cwd: dir, workspace: {} as any, config: {} as any, events: {} as any, agentId: 'test' };
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('renames symbol across multiple files atomically', async () => {
    const res = await renameSymbolTool.execute({ old_name: 'calculateTotal', new_name: 'computeSum' }, ctx);
    expect(res).toContain('Renamed "calculateTotal" -> "computeSum" across 2 file(s)');

    const calcContent = readFileSync(resolve(dir, 'src', 'calc.ts'), 'utf8');
    expect(calcContent).toContain('export function computeSum(');
    expect(calcContent).not.toContain('calculateTotal');

    const mainContent = readFileSync(resolve(dir, 'src', 'main.ts'), 'utf8');
    expect(mainContent).toContain('import { computeSum }');
    expect(mainContent).toContain('const sum = computeSum(1, 2);');
  });

  it('supports preview mode without writing changes', async () => {
    const res = await renameSymbolTool.execute({ old_name: 'calculateTotal', new_name: 'computeSum', preview: true }, ctx);
    expect(res).toContain('[PREVIEW]');

    const calcContent = readFileSync(resolve(dir, 'src', 'calc.ts'), 'utf8');
    expect(calcContent).toContain('calculateTotal');
  });

  it('AST path renames TS identifiers but leaves comments and strings intact', async () => {
    // decoy.ts has the symbol ONLY in a comment and a string — AST must not touch it.
    writeFileSync(resolve(dir, 'src', 'decoy.ts'), '// calculateTotal is a great function\nconst label = "calculateTotal";\n');
    const res = await renameSymbolTool.execute({ old_name: 'calculateTotal', new_name: 'computeSum' }, ctx);
    expect(String(res)).toContain('via AST');

    const decoy = readFileSync(resolve(dir, 'src', 'decoy.ts'), 'utf8');
    // real identifier renamed, comment + string untouched
    expect(decoy).toContain('// calculateTotal is a great function');
    expect(decoy).toContain('"calculateTotal"');
    expect(decoy).not.toContain('computeSum');
  });

  it('still renames real occurrences and reports via-AST mode in the summary', async () => {
    const res = await renameSymbolTool.execute({ old_name: 'calculateTotal', new_name: 'computeSum' }, ctx);
    expect(String(res)).toContain('Renamed "calculateTotal" -> "computeSum"');
    expect(String(res)).toContain('via AST');
    expect(String(res)).toContain('comments/strings left untouched');
  });

  it('renames non-TS files via the labeled word-boundary fallback', async () => {
    writeFileSync(resolve(dir, 'script.py'), 'def calculateTotal(a, b):\n    return calculateTotal(a, b)\n');
    const res = await renameSymbolTool.execute({ old_name: 'calculateTotal', new_name: 'computeSum' }, ctx);
    expect(String(res)).toContain('via word-boundary regex');
    const py = readFileSync(resolve(dir, 'script.py'), 'utf8');
    expect(py).toContain('def computeSum(a, b):');
  });
});
