import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { definitionsInSource, findTsDefinitions } from './symbol-defs.js';

const SRC = `
export function alpha(a: number): string { return String(a); }
export const beta = (x: number) => x * 2;
export class Gamma { delta(): void {} }
export interface Delta { field: string }
export type Epsilon = string | number;
export enum Zeta { One, Two }
const notADefinition = alpha(1); // a CALL, not a declaration
// alpha mentioned in a comment — must NOT be a definition
const s = 'alpha inside a string';
export function outer() {
  const innerLocal = 1;
  return innerLocal;
}
`;

describe('definitionsInSource (AST-accurate)', () => {
  it('finds each declaration kind with exact line/col and a stripped signature', () => {
    const alpha = definitionsInSource('a.ts', SRC, 'alpha');
    expect(alpha).toHaveLength(1); // the CALL and comment mention must not count
    expect(alpha[0].kind).toBe('function');
    expect(alpha[0].line).toBe(2);
    expect(alpha[0].signature).toBe('export function alpha(a: number): string');

    expect(definitionsInSource('a.ts', SRC, 'beta')[0]).toMatchObject({ kind: 'const' });
    expect(definitionsInSource('a.ts', SRC, 'Gamma')[0].kind).toBe('class');
    expect(definitionsInSource('a.ts', SRC, 'Delta')[0].kind).toBe('interface');
    expect(definitionsInSource('a.ts', SRC, 'Epsilon')[0].kind).toBe('type');
    expect(definitionsInSource('a.ts', SRC, 'Zeta')[0].kind).toBe('enum');
  });

  it('never reports a call site, comment, or string as a definition', () => {
    // "alpha" appears as a call (line 12), in a comment (line 13), and in a
    // string (line 14) — but only the real function declaration on line 2.
    expect(definitionsInSource('a.ts', SRC, 'alpha')).toHaveLength(1);
    expect(definitionsInSource('a.ts', SRC, 'String')).toHaveLength(0);
    expect(definitionsInSource('a.ts', SRC, 'nope')).toHaveLength(0);
  });

  it('finds methods and locals scoped to their function', () => {
    const delta = definitionsInSource('a.ts', SRC, 'delta');
    expect(delta).toHaveLength(1);
    expect(delta[0].kind).toBe('method');
    const inner = definitionsInSource('a.ts', SRC, 'innerLocal');
    expect(inner).toHaveLength(1);
    expect(inner[0].kind).toBe('const');
  });

  it('handles destructuring declarations', () => {
    const src = 'const { a: renamed, b } = obj;';
    const a = definitionsInSource('a.ts', src, 'renamed');
    expect(a).toHaveLength(1);
    expect(a[0].kind).toBe('const');
    expect(definitionsInSource('a.ts', src, 'b')).toHaveLength(1);
  });

  it('returns [] for unknown symbols and empty sources without throwing', () => {
    expect(definitionsInSource('a.ts', '', 'x')).toEqual([]);
    expect(definitionsInSource('a.ts', 'const x = 1;', 'y')).toEqual([]);
  });
});

describe('findTsDefinitions (walker)', () => {
  let dir: string;
  it('walks a tree, respects ignores, and reports POSIX-relative paths', () => {
    dir = mkdtempSync(join(tmpdir(), 'mochi-symdefs-'));
    try {
      mkdirSync(join(dir, 'src', 'nested'), { recursive: true });
      mkdirSync(join(dir, 'node_modules', 'junk'), { recursive: true });
      writeFileSync(join(dir, 'src', 'a.ts'), 'export function walker() {}\n');
      writeFileSync(join(dir, 'src', 'nested', 'b.ts'), 'export class Walker2 {}\nexport const walker = 1;\n');
      writeFileSync(join(dir, 'node_modules', 'junk', 'c.ts'), 'export function walker() {}\n'); // ignored
      const res = findTsDefinitions(dir, dir, 'walker');
      expect(res).not.toBeNull();
      const files = (res ?? []).map((r) => r.file).sort();
      expect(files).toContain('src/a.ts');
      expect(files).toContain('src/nested/b.ts');
      expect(files.some((f) => f.startsWith('node_modules'))).toBe(false);
      // two real declarations (function walker + const walker), Walker2 is a different symbol
      expect((res ?? []).filter((r) => r.kind !== 'class')).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('scopes to a single file when given one', () => {
    dir = mkdtempSync(join(tmpdir(), 'mochi-symdefs-file-'));
    try {
      writeFileSync(join(dir, 'only.ts'), 'export function lone() {}\n');
      const res = findTsDefinitions(dir, join(dir, 'only.ts'), 'lone');
      expect(res).toHaveLength(1);
      expect(res![0].kind).toBe('function');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns [] for a missing scope, not a throw', () => {
    expect(findTsDefinitions('/nonexistent-xyz', '/nonexistent-xyz', 'x')).toEqual([]);
  });
});
