import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mochiStateDir } from './mochi-dir.js';
import { projectMemoryPath } from '../memory/project-memory.js';
import { skillUsagePath } from '../skills/skills.js';

describe('mochiStateDir', () => {
  it('appends .mochi to a project root', () => {
    expect(mochiStateDir('/proj')).toBe('/proj/.mochi');
  });

  it('is idempotent when handed the state dir itself', () => {
    expect(mochiStateDir('/proj/.mochi')).toBe('/proj/.mochi');
    expect(mochiStateDir('/proj/.mochi/')).toBe('/proj/.mochi');
  });

  it('never produces a nested .mochi/.mochi', () => {
    expect(mochiStateDir('/proj/.mochi')).not.toContain('.mochi/.mochi');
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
