import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { saveNamedCheckpoint, listNamedCheckpoints, deleteNamedCheckpoint, restoreNamedCheckpoint } from './checkpoint-manager.js';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function git(cwd: string, args: string[]): void {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
}

describe('Named Checkpoint Manager', () => {
  it('saves, lists, and deletes named checkpoints', async () => {
    const cwd = process.cwd();
    const cp = await saveNamedCheckpoint(cwd, 'test-checkpoint', 'Unit test snapshot');

    expect(cp.name).toBe('test-checkpoint');
    expect(cp.description).toBe('Unit test snapshot');
    expect(cp.createdAt).toBeDefined();

    const list = listNamedCheckpoints(cwd);
    expect(list.some(c => c.name === 'test-checkpoint')).toBe(true);

    const deleted = deleteNamedCheckpoint(cwd, 'test-checkpoint');
    expect(deleted).toBe(true);
  });

  describe('end-to-end restore in a real repo', () => {
    let dir: string;

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'mochi-cp-'));
      git(dir, ['init', '-q']);
      git(dir, ['config', 'user.email', 't@t']);
      git(dir, ['config', 'user.name', 't']);
      writeFileSync(join(dir, 'a.txt'), 'v1\n');
      git(dir, ['add', '-A']);
      git(dir, ['commit', '-qm', 'init']);
    });
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('re-applies the working-tree patch on restore (patch keeps its trailing newline)', async () => {
      // Dirty the tree after the commit, then checkpoint.
      writeFileSync(join(dir, 'a.txt'), 'v2\n');
      const cp = await saveNamedCheckpoint(dir, 'snap', 'before risky change');
      // git patches are newline-terminated; a trimmed patch is "corrupt".
      expect(cp.patch.endsWith('\n')).toBe(true);

      // Mutate further (simulate the risky change that must be rolled back).
      writeFileSync(join(dir, 'a.txt'), 'broken\n');

      const res = await restoreNamedCheckpoint(dir, 'snap');
      expect(res.success).toBe(true);
      expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('v2\n');
    });

    it('repairs a legacy stored patch with no trailing newline on restore', async () => {
      writeFileSync(join(dir, 'a.txt'), 'v3\n');
      const cp = await saveNamedCheckpoint(dir, 'snap2');
      // Simulate an old checkpoint saved with the trimming bug.
      expect(cp.patch.endsWith('\n')).toBe(true);
      const legacy = { ...cp, name: 'legacy', patch: cp.patch.replace(/\n+$/, '') };
      const { writeFileSync: wf } = await import('node:fs');
      wf(join(dir, '.mochi', 'checkpoints', 'legacy.json'), JSON.stringify(legacy), 'utf8');

      writeFileSync(join(dir, 'a.txt'), 'broken\n');
      const res = await restoreNamedCheckpoint(dir, 'legacy');
      expect(res.success).toBe(true);
      expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('v3\n');
    });
  });
});
