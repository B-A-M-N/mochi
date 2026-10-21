import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { mochiStateDir } from './mochi-dir.js';
import { projectMemoryPath } from '../memory/project-memory.js';
import { skillUsagePath } from '../skills/skills.js';

describe('mochiStateDir', () => {
  it('appends .mochi to a project root', () => {
    // sep-aware: on win32 the product returns 'D:\proj\.mochi' — the join
    // result is the platform-correct expectation; a literal '/proj/.mochi'
    // was a POSIX-only assertion that could never pass on Windows.
    const root = resolve('D:\\proj'.replace('D:\\', sep === '\\' ? 'D:\\' : '/'));
    expect(mochiStateDir(root)).toBe(join(root, '.mochi'));
  });

  it('is idempotent when handed the state dir itself', () => {
    const state = join(resolve(sep === '\\' ? 'D:\\proj' : '/proj'), '.mochi');
    expect(mochiStateDir(state)).toBe(state);
    expect(mochiStateDir(state + sep)).toBe(state);
  });

  it('never produces a nested .mochi/.mochi', () => {
    const state = join(resolve(sep === '\\' ? 'D:\\proj' : '/proj'), '.mochi');
    expect(mochiStateDir(state)).not.toContain(join('.mochi', '.mochi'));
  });
});

describe('state-path helpers accept either a root or the state dir', () => {
  it('resolves to the same canonical location', () => {
    const root = mkdtempSync(join(tmpdir(), 'mochi-dir-'));
    const state = join(root, '.mochi');
    expect(projectMemoryPath(state)).toBe(projectMemoryPath(root));
    expect(skillUsagePath(state)).toBe(skillUsagePath(root));
    expect(projectMemoryPath(root)).toBe(resolve(root, '.mochi', 'project-memory.md'));
    expect(projectMemoryPath(root)).not.toContain(join('.mochi', '.mochi'));
  });
});
