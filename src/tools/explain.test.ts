// explain tool: code comprehension for symbols/files/concepts.
import { describe, it, expect } from 'vitest';
import { explainTool } from './explain.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

describe('explainTool', () => {
  it('requires a target', async () => {
    const r = await explainTool.execute({}, { cwd: '/tmp' } as never);
    expect(String(r)).toContain('Usage:');
  });

  it('explains a file: reads it, lists exports, previews', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-explain-'));
    writeFileSync(resolve(dir, 'math.ts'), 'export function add(a: number, b: number): number { return a + b; }\nexport const PI = 3.14;\n');
    const r = await explainTool.execute({ target: 'math.ts' }, { cwd: dir } as never);
    const s = String(r);
    expect(s).toContain('math.ts');
    expect(s).toContain('add');
    expect(s).toContain('PI');
    expect(s).toContain('export function add');
  });

  it('handles a symbol/concept target with guidance', async () => {
    const r = await explainTool.execute({ target: 'AuthService' }, { cwd: '/tmp' } as never);
    const s = String(r);
    expect(s).toContain('AuthService');
    expect(s).toContain('find_definitions');
  });

  it('brief depth truncates', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'mochi-explain-'));
    writeFileSync(resolve(dir, 'big.ts'), 'export const x = 1;\n// line2\n// line3\n// line4\n');
    const full = String(await explainTool.execute({ target: 'big.ts' }, { cwd: dir } as never));
    const brief = String(await explainTool.execute({ target: 'big.ts', depth: 'brief' }, { cwd: dir } as never));
    expect(brief.length).toBeLessThan(full.length);
  });
});