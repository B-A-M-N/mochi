import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { collectWorkspaceFiles, workspaceListMessage } from './workspace-list.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'mochi-wslist-'));
  writeFileSync(join(dir, 'README.md'), '# x\n');
  writeFileSync(join(dir, 'answer.txt'), 'x\n');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'auth.js'), 'x\n');
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'x\n');
  // Noise that must never be listed:
  mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(dir, 'node_modules', 'pkg', 'index.js'), 'x\n');
  mkdirSync(join(dir, 'dist'));
  writeFileSync(join(dir, 'dist', 'cli.js'), 'x\n');
  mkdirSync(join(dir, '.git'));
  writeFileSync(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  mkdirSync(join(dir, '.hidden-extra'));
  writeFileSync(join(dir, '.hidden-extra', 'x.js'), 'x\n');
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('collectWorkspaceFiles', () => {
  it('lists every file, sorted, excluding build/VCS/noise dirs', () => {
    const files = collectWorkspaceFiles(dir);
    expect(files).not.toBeNull();
    expect(files!).toEqual([
      '.github/workflows/ci.yml',
      'README.md',
      'answer.txt',
      'src/auth.js',
    ]);
  });

  it('returns null for an empty workspace', () => {
    const empty = mkdtempSync(resolve(tmpdir(), 'mochi-wslist-empty-'));
    try {
      expect(collectWorkspaceFiles(empty)).toBeNull();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('is full-or-nothing under the byte cap (no truncated trees)', () => {
    const big = mkdtempSync(resolve(tmpdir(), 'mochi-wslist-big-'));
    try {
      for (let i = 0; i < 50; i++) {
        writeFileSync(join(big, `file-number-${i}-with-a-longish-name.txt`), 'x\n');
      }
      // ~50 files × ~40 chars ≈ 2KB: fits the default 6KB cap.
      expect(collectWorkspaceFiles(big)).toHaveLength(50);
      // A tiny cap skips the whole listing instead of shipping a half-tree.
      expect(collectWorkspaceFiles(big, { maxBytes: 100 })).toBeNull();
    } finally {
      rmSync(big, { recursive: true, force: true });
    }
  });
});

describe('workspaceListMessage', () => {
  it('renders a count header and marks the paths authoritative', () => {
    const msg = workspaceListMessage(dir);
    expect(msg).toContain('Workspace files (4)');
    expect(msg).toContain('src/auth.js');
    expect(msg).toContain('authoritative');
    // The kill: the model must not spend a turn enumerating what we shipped.
    expect(msg).toContain('instead of listing directories first');
  });
});
