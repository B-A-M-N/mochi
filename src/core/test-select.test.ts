import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parsePorcelainFiles,
  candidateTestPaths,
  selectRelatedTests,
  detectRunner,
  buildTargetedTestCommand,
  isTestFile,
  normalizeRel,
} from './test-select.js';
import type { RepoInfo } from '../types.js';

describe('test-select: pure helpers', () => {
  it('parses porcelain status incl. untracked, renames, and quoted paths', () => {
    const text = [
      '## main...origin/main',
      ' M src/a.ts',
      '?? src/new.ts',
      'R  src/old.ts -> src/moved.ts',
      ' M "src/with space.ts"',
      '',
    ].join('\n');
    expect(parsePorcelainFiles(text)).toEqual([
      'src/a.ts',
      'src/new.ts',
      'src/moved.ts',
      'src/with space.ts',
    ]);
  });

  it('normalizes path forms', () => {
    expect(normalizeRel('./a\\b.ts')).toBe('a/b.ts');
    expect(normalizeRel('src/x.ts')).toBe('src/x.ts');
  });

  it('recognizes test files across ecosystems', () => {
    expect(isTestFile('src/a.test.ts')).toBe(true);
    expect(isTestFile('src/a.spec.js')).toBe(true);
    expect(isTestFile('pkg/a_test.go')).toBe(true);
    expect(isTestFile('tests/test_a.py')).toBe(true);
    expect(isTestFile('src/a.ts')).toBe(false);
  });

  it('generates mirrored candidates for each language', () => {
    expect(candidateTestPaths('src/util/parse.ts')).toContain('src/util/parse.test.ts');
    expect(candidateTestPaths('src/util/parse.ts')).toContain('src/util/__tests__/parse.test.ts');
    expect(candidateTestPaths('lib/mod.py')).toContain('lib/test_mod.py');
    expect(candidateTestPaths('pkg/handler.go')).toContain('pkg/handler_test.go');
    expect(candidateTestPaths('app/models/user.rb')).toContain('app/models/user_spec.rb');
  });
});

describe('test-select: selectRelatedTests', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mch-tests-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const touch = (rel: string, content = '') => {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };

  it('maps a changed source file to its mirrored test', () => {
    touch('src/util/parse.ts');
    touch('src/util/parse.test.ts');
    const r = selectRelatedTests(dir, ['src/util/parse.ts']);
    expect(r.tests).toEqual(['src/util/parse.test.ts']);
    expect(r.reason).toContain('mirrored');
  });

  it('includes a changed test file itself', () => {
    touch('src/a.test.ts');
    const r = selectRelatedTests(dir, ['src/a.test.ts']);
    expect(r.tests).toEqual(['src/a.test.ts']);
  });

  it('falls back to []=full-suite when a non-code file changed', () => {
    touch('src/a.ts');
    touch('src/a.test.ts');
    const r = selectRelatedTests(dir, ['src/a.ts', 'package.json']);
    expect(r.tests).toEqual([]);
    expect(r.reason).toContain('non-code');
  });

  it('falls back when too many files changed', () => {
    const many = Array.from({ length: 20 }, (_, i) => `src/f${i}.ts`);
    const r = selectRelatedTests(dir, many, { maxChanged: 12 });
    expect(r.tests).toEqual([]);
    expect(r.reason).toContain('limit');
  });

  it('finds a non-mirrored test that imports the changed module', () => {
    touch('src/lib/money.ts', 'export const usd = (n: number) => n;');
    touch('test/ledger.test.ts', "import { usd } from '../src/lib/money.js';\nusd(1);\n");
    const r = selectRelatedTests(dir, ['src/lib/money.ts']);
    expect(r.tests).toEqual(['test/ledger.test.ts']);
    expect(r.reason).toContain('importing');
  });

  it('returns nothing when no test references the change', () => {
    touch('src/lib/money.ts');
    const r = selectRelatedTests(dir, ['src/lib/money.ts']);
    expect(r.tests).toEqual([]);
  });
});

describe('test-select: runner detection + command build', () => {
  const repo = (over: Partial<RepoInfo> = {}): RepoInfo => ({ testCommand: 'npm test', ...over });

  it('detects runners from the command string', () => {
    expect(detectRunner('/nonexistent', repo({ testCommand: 'npx vitest run' }))).toBe('vitest');
    expect(detectRunner('/nonexistent', repo({ testCommand: 'jest' }))).toBe('jest');
    expect(detectRunner('/nonexistent', repo({ testCommand: 'pytest -q' }))).toBe('pytest');
    expect(detectRunner('/nonexistent', repo({ testCommand: 'go test ./...' }))).toBe('go');
    expect(detectRunner('/nonexistent', repo())).toBe('pm-script');
  });

  it('builds targeted commands per runner', () => {
    expect(buildTargetedTestCommand(repo(), ['a.test.ts'], 'vitest')).toBe('npx vitest run a.test.ts');
    expect(buildTargetedTestCommand(repo(), ['a_test.py'], 'pytest')).toBe('python -m pytest a_test.py');
    expect(buildTargetedTestCommand(repo(), ['pkg/a_test.go'], 'go')).toBe('go test ./pkg/');
    expect(buildTargetedTestCommand(repo(), ['a.test.ts', 'b c.test.ts'], 'pm-script')).toBe(
      'npm test -- a.test.ts "b c.test.ts"',
    );
    expect(buildTargetedTestCommand(repo(), ['a.rs'], 'unknown')).toBeUndefined();
  });
});
