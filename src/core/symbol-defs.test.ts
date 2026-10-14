import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { definitionsInSource, findTsDefinitions, referencesInSource, findTsReferences, identifierSpansInSource, renameSymbolInSource } from './symbol-defs.js';

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

describe('referencesInSource (AST-accurate references)', () => {
  const SRC = [
    'import { alpha } from "./a.js";',        // 1: import
    'export function alpha() { return 1; }',  // 2: declaration
    'const call = alpha();',                  // 3: call
    '// alpha in a comment',                  // 4: comment — must NOT count
    "const s = 'alpha in a string';",         // 5: string — must NOT count
    'const obj = { alpha: 2 };',              // 6: property key
    'type T = alpha;',                        // 7: type reference (if alpha were a type)
    'const n = new alpha();',                 // 8: constructor
  ].join('\n');

  it('finds real identifier references and tags their usage', () => {
    const refs = referencesInSource('a.ts', SRC, 'alpha');
    const lines = refs.map((r) => r.line).sort((a, b) => a - b);
    // Lines 1,2,3,6,7,8 are real identifier occurrences; 4 (comment) and
    // 5 (string) are trivia and must be excluded.
    expect(lines).toEqual([1, 2, 3, 6, 7, 8]);
    const byLine = new Map(refs.map((r) => [r.line, r.usage]));
    expect(byLine.get(1)).toBe('import');
    expect(byLine.get(2)).toBe('declaration');
    expect(byLine.get(3)).toBe('call');
    expect(byLine.get(8)).toBe('constructor');
  });

  it('excludes the symbol when it only appears in comments and strings', () => {
    const src = '// alpha\nconst s = "alpha";\n/* alpha */\n';
    expect(referencesInSource('a.ts', src, 'alpha')).toEqual([]);
  });

  it('captures trimmed source-line context', () => {
    const refs = referencesInSource('a.ts', 'const   call = alpha();  \n', 'alpha');
    expect(refs).toHaveLength(1);
    expect(refs[0].text).toBe('const   call = alpha();');
    expect(refs[0].usage).toBe('call');
  });

  it('returns [] for empty/unknown without throwing', () => {
    expect(referencesInSource('a.ts', '', 'x')).toEqual([]);
    expect(referencesInSource('a.ts', 'const y = 1;', 'x')).toEqual([]);
  });
});

describe('findTsReferences (walker)', () => {
  it('walks files and reports POSIX-relative paths, respecting ignores', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mochi-symrefs-'));
    try {
      mkdirSync(join(dir, 'src'), { recursive: true });
      mkdirSync(join(dir, 'node_modules', 'junk'), { recursive: true });
      writeFileSync(join(dir, 'src', 'a.ts'), 'export function target() {}\n');
      writeFileSync(join(dir, 'src', 'b.ts'), 'import { target } from "./a.js";\ntarget();\n');
      writeFileSync(join(dir, 'node_modules', 'junk', 'c.ts'), 'target();\n'); // ignored
      const res = findTsReferences(dir, dir, 'target');
      expect(res).not.toBeNull();
      const files = new Set((res ?? []).map((r) => r.file));
      expect(files.has('src/a.ts')).toBe(true);
      expect(files.has('src/b.ts')).toBe(true);
      expect([...files].some((f) => f.startsWith('node_modules'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns [] for a missing scope', () => {
    expect(findTsReferences('/nonexistent-abc', '/nonexistent-abc', 'x')).toEqual([]);
  });
});

describe('identifierSpansInSource + renameSymbolInSource (safe rename)', () => {
  const SRC = [
    'import { alpha } from "./a.js";',   // 1
    'export function alpha() {',          // 2
    '  return "alpha in a string";',      // 3 — string, must NOT be renamed
    '}',                                  // 4
    '// alpha in a comment',              // 5 — comment, must NOT be renamed
    'const call = alpha();',              // 6 — call, real identifier
  ].join('\n');

  it('spans only real identifiers, sorted right-to-left for safe splicing', () => {
    const spans = identifierSpansInSource('a.ts', SRC, 'alpha');
    // lines 1,2,6 have real identifiers; 3 (string) and 5 (comment) don't.
    expect(spans).toHaveLength(3);
    // right-to-left: descending start offsets
    const starts = spans.map((s) => s.start);
    expect([...starts].sort((a, b) => b - a)).toEqual(starts);
  });

  it('renames identifiers without touching comments or strings', () => {
    const res = renameSymbolInSource('a.ts', SRC, 'alpha', 'beta');
    expect(res).not.toBeNull();
    expect(res!.count).toBe(3);
    expect(res!.content).toContain('import { beta }');
    expect(res!.content).toContain('export function beta()');
    expect(res!.content).toContain('const call = beta();');
    // the string literal and the comment keep the old word verbatim
    expect(res!.content).toContain('"alpha in a string"');
    expect(res!.content).toContain('// alpha in a comment');
  });

  it('reports count 0 and unchanged content when the symbol is absent', () => {
    const res = renameSymbolInSource('a.ts', SRC, 'zzz', 'yyy');
    expect(res).toEqual({ content: SRC, count: 0 });
  });

  it('handles multi-byte and overlapping-safe offsets (unicode symbol)', () => {
    const src = 'const café = 1;\nconst x = café + café;\n';
    const res = renameSymbolInSource('a.ts', src, 'café', 'coffee');
    expect(res!.count).toBe(3);
    expect(res!.content).toBe('const coffee = 1;\nconst x = coffee + coffee;\n');
  });
});
