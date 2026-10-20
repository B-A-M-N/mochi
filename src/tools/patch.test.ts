import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { patchTool, parsePatch, applyFilePatch } from './patch.js';
import { fuzzyFindUnique } from './fuzzy-match.js';
import type { ToolContext } from './types.js';

let dir: string;

function ctx(): ToolContext {
  return {
    cwd: dir,
    workspace: {} as never,
    config: {} as never,
    events: { emit: () => {} } as never,
    agentId: 't',
  };
}

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'mochi-patch-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('fuzzyFindUnique', () => {
  it('finds a block when indentation differs', () => {
    const file = 'function a() {\n    if (x) {\n        return 1;\n    }\n}\n';
    const needle = 'if (x) {\n  return 1;\n}';
    const m = fuzzyFindUnique(file, needle);
    expect(m).not.toBeNull();
    expect(file.slice(m!.start, m!.end)).toContain('if (x)');
    expect(file.slice(m!.start, m!.end)).toContain('return 1');
  });

  it('returns null for ambiguous matches', () => {
    const file = 'const a = 1;\nconst b = 2;\nconst a = 1;\n';
    expect(fuzzyFindUnique(file, 'const a = 1;')).toBeNull();
  });

  it('returns null when there is no match', () => {
    expect(fuzzyFindUnique('abc\ndef\n', 'xyz')).toBeNull();
  });
});

describe('parsePatch', () => {
  it('parses add, update, and delete sections', () => {
    const patch = [
      'Some prose before the patch.',
      '*** Begin Patch',
      '*** Add File: new.ts',
      '+export const x = 1;',
      '*** Update File: app.ts',
      '@@ class App',
      ' context',
      '-old line',
      '+new line',
      '*** Delete File: gone.ts',
      '*** End Patch',
    ].join('\n');
    const patches = parsePatch(patch);
    expect(patches).toHaveLength(3);
    expect(patches[0]).toMatchObject({ op: 'add', path: 'new.ts' });
    expect(patches[1]).toMatchObject({ op: 'update', path: 'app.ts', anchor: 'class App' });
    expect(patches[2]).toMatchObject({ op: 'delete', path: 'gone.ts' });
    expect(patches[1].lines).toEqual([
      { kind: 'ctx', text: 'context' },
      { kind: 'del', text: 'old line' },
      { kind: 'add', text: 'new line' },
    ]);
  });

  it('rejects a missing Begin Patch', () => {
    expect(() => parsePatch('+foo')).toThrow('Begin Patch');
  });

  it('rejects unknown directives', () => {
    expect(() => parsePatch('*** Begin Patch\n*** Rename File: x\n*** End Patch')).toThrow('Unknown patch directive');
  });

  it('rejects malformed body lines', () => {
    expect(() => parsePatch('*** Begin Patch\n*** Update File: a.ts\nbad line\n*** End Patch')).toThrow('Malformed');
  });
});

describe('patch tool (real files)', () => {
  it('adds, updates, and deletes files', async () => {
    writeFileSync(join(dir, 'app.ts'), 'function setup() {\n  const value = old;\n  return value;\n}\n');
    writeFileSync(join(dir, 'gone.ts'), 'obsolete\n');

    const out = await patchTool.execute({
      patch: [
        '*** Begin Patch',
        '*** Add File: new.ts',
        '+export const x = 1;',
        '*** Update File: app.ts',
        ' function setup() {',
        '-  const value = old;',
        '+  const value = new;',
        '*** Delete File: gone.ts',
        '*** End Patch',
      ].join('\n'),
    }, ctx());

    expect(out).toContain('3 file(s)');
    expect(readFileSync(join(dir, 'new.ts'), 'utf8')).toBe('export const x = 1;\n');
    expect(readFileSync(join(dir, 'app.ts'), 'utf8')).toContain('const value = new;');
    expect(readFileSync(join(dir, 'app.ts'), 'utf8')).not.toContain('old;');
    expect(existsSync(join(dir, 'gone.ts'))).toBe(false);
  });

  it('applies updates even when remembered context whitespace drifts', async () => {
    // File on disk uses 4-space indentation; the patch remembers 2-space.
    writeFileSync(join(dir, 'deep.ts'), 'function a() {\n    if (x) {\n        return 1;\n    }\n    return 0;\n}\n');

    const out = await patchTool.execute({
      patch: [
        '*** Begin Patch',
        '*** Update File: deep.ts',
        ' function a() {',
        '   if (x) {',
        '-      return 1;',
        '+      return 42;',
        '*** End Patch',
      ].join('\n'),
    }, ctx());

    expect(out).toContain('updated deep.ts');
    const after = readFileSync(join(dir, 'deep.ts'), 'utf8');
    expect(after).toContain('return 42;');
    expect(after).toContain('    return 0;'); // untouched tail preserved
  });

  it('preserves context lines instead of deleting them (region corruption regression)', async () => {
    writeFileSync(join(dir, 'app.ts'), 'function setup() {\n  const value = old;\n  return value;\n}\n');
    await patchTool.execute({
      patch: [
        '*** Begin Patch',
        '*** Update File: app.ts',
        ' function setup() {',
        '-  const value = old;',
        '+  const value = new;',
        '*** End Patch',
      ].join('\n'),
    }, ctx());
    const after = readFileSync(join(dir, 'app.ts'), 'utf8');
    // The context line (function header) must survive the edit.
    expect(after).toBe('function setup() {\n  const value = new;\n  return value;\n}\n');
    expect(after).toContain('function setup() {');
  });

  it('fails when context cannot be located', async () => {
    writeFileSync(join(dir, 'a.ts'), 'one\ntwo\nthree\n');
    await expect(patchTool.execute({
      patch: '*** Begin Patch\n*** Update File: a.ts\n nope\n*** End Patch',
    }, ctx())).rejects.toThrow('Could not locate');
  });

  it('refuses to add an existing file and to update a missing one', async () => {
    writeFileSync(join(dir, 'exists.ts'), 'x');
    await expect(patchTool.execute({
      patch: '*** Begin Patch\n*** Add File: exists.ts\n+x\n*** End Patch',
    }, ctx())).rejects.toThrow('already exists');
    await expect(patchTool.execute({
      patch: '*** Begin Patch\n*** Update File: missing.ts\n a\n*** End Patch',
    }, ctx())).rejects.toThrow('not found');
  });
});

describe('applyFilePatch (unit)', () => {
  it('appends pure additions before the trailing newline', () => {
    const out = applyFilePatch('a\nb\n', { op: 'update', path: 'x', lines: [{ kind: 'add', text: 'c' }] });
    expect(out).toBe('a\nb\nc\n');
  });
});

describe('patch tool — multi-hunk single file', () => {
  it('parses @@ groups into separate hunks', () => {
    const patches = parsePatch([
      '*** Begin Patch',
      '*** Update File: f.ts',
      '@@ first',
      ' const A = 1;',
      '-const B = 2;',
      '+const B = 20;',
      '@@ second',
      ' const C = 3;',
      '-const D = 4;',
      '+const D = 40;',
      '*** End Patch',
    ].join('\n'));
    expect(patches[0].hunks).toHaveLength(2);
  });

  it('applies every hunk of a multi-hunk update', async () => {
    writeFileSync(join(dir, 'f.ts'), 'const A = 1;\nconst B = 2;\nconst C = 3;\nconst D = 4;\n');
    const out = await patchTool.execute({
      patch: [
        '*** Begin Patch',
        '*** Update File: f.ts',
        '@@ first',
        ' const A = 1;',
        '-const B = 2;',
        '+const B = 20;',
        '@@ second',
        ' const C = 3;',
        '-const D = 4;',
        '+const D = 40;',
        '*** End Patch',
      ].join('\n'),
    }, ctx());
    expect(out).toContain('updated f.ts');
    const after = readFileSync(join(dir, 'f.ts'), 'utf8');
    expect(after).toBe('const A = 1;\nconst B = 20;\nconst C = 3;\nconst D = 40;\n');
  });
});

describe('patch tool — atomicity', () => {
  it('writes NOTHING when any file in a multi-file patch fails to locate', async () => {
    writeFileSync(join(dir, 'a.ts'), 'one\ntwo\n');
    writeFileSync(join(dir, 'b.ts'), 'alpha\nbeta\n');
    await expect(patchTool.execute({
      patch: [
        '*** Begin Patch',
        '*** Update File: a.ts',
        ' one',
        '-two',
        '+TWO',
        '*** Update File: b.ts',
        ' nope',
        '-beta',
        '+BETA',
        '*** End Patch',
      ].join('\n'),
    }, ctx())).rejects.toThrow('Could not locate');
    // The first file's valid hunk must NOT have been applied.
    expect(readFileSync(join(dir, 'a.ts'), 'utf8')).toBe('one\ntwo\n');
    expect(readFileSync(join(dir, 'b.ts'), 'utf8')).toBe('alpha\nbeta\n');
  });
});

describe('patch tool — duplicate sections for the same file (B13)', () => {
  it('applies BOTH update sections for the same file sequentially (second builds on first)', async () => {
    // Two *** Update File: sections for the same file. Phase 1 plans each
    // section from the SAME on-disk content; phase 2 used to write plan 2
    // over plan 1 — the first edit was silently lost while the output
    // claimed both were applied.
    writeFileSync(join(dir, 'dup.ts'), 'const A = 1;\nconst B = 2;\n');
    const out = await patchTool.execute({
      patch: [
        '*** Begin Patch',
        '*** Update File: dup.ts',
        '-const A = 1;',
        '+const A = 10;',
        '*** Update File: dup.ts',
        '-const B = 2;',
        '+const B = 20;',
        '*** End Patch',
      ].join('\n'),
    }, ctx());
    expect(out).toContain('updated dup.ts');
    const after = readFileSync(join(dir, 'dup.ts'), 'utf8');
    // Both edits must survive.
    expect(after).toBe('const A = 10;\nconst B = 20;\n');
  });

  it('update-then-update with overlapping context applies sequentially without corruption', async () => {
    // Section 2's context includes what section 1 changed — only correct
    // when sections compose sequentially.
    writeFileSync(join(dir, 'seq.ts'), 'const x = 1;\nconst y = x + 1;\n');
    const out = await patchTool.execute({
      patch: [
        '*** Begin Patch',
        '*** Update File: seq.ts',
        '-const x = 1;',
        '+const x = 5;',
        '*** Update File: seq.ts',
        '-const y = x + 1;',
        '+const y = x + 2;',
        '*** End Patch',
      ].join('\n'),
    }, ctx());
    expect(out).toContain('updated seq.ts');
    expect(readFileSync(join(dir, 'seq.ts'), 'utf8')).toBe('const x = 5;\nconst y = x + 2;\n');
  });
});
