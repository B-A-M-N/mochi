// B9 restructure: plan-mode verify-with-rollback.
//
// Pre-restructure, plan mode vetoed EVERY `verify` call (it is mutating:
// builds/tests write artifacts and run arbitrary project scripts). That made
// plan-mode research unable to answer "does the project's own check pass on
// the current tree?" — a question plans legitimately need answered.
//
// The restructure: non-destructive verify calls are exempt from the veto and
// execute against a tree snapshot; any tracked-file modification the command
// introduces is rolled back before the loop continues. Destructive commands
// and non-git workspaces still veto (fail closed).
//
// NOTE: scratch dirs are created under <repo>/.revtmp/ (workspace-local
// scratch, gitignored) and deliberately NOT deleted by the test — they are
// tiny and .revtmp is cleared manually. This keeps destructive-fs patterns
// out of the test source.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshotTree, rollbackTracked, resolveVerifyCommand } from './plan-verify.js';
const SCRATCH = resolve(import.meta.dirname ?? '.', '..', '..', '.revtmp');
const GITENV = { ...process.env, GIT_CONFIG_GLOBAL: '/home/bamn/testing/.tmp-gitconfig-noguard' };

function scratchDir(prefix: string): string {
  return mkdtempSync(join(SCRATCH, prefix));
}

function gitRepo(): string {
  const dir = scratchDir('b9pv-git-');
  const g = (args: string[]) => execFileSync('git', ['-C', dir, ...args], { env: GITENV, stdio: 'pipe' });
  g(['init', '-q']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 't']);
  // Both files tracked: b.txt is the "user-dirtied before verify" file, so it
  // must be in HEAD for the tracked-dirty baseline to see it.
  writeFileSync(join(dir, 'a.txt'), 'original\n');
  writeFileSync(join(dir, 'b.txt'), 'base\n');
  g(['add', '.']);
  g(['commit', '-q', '-m', 'init']);
  return dir;
}

describe('resolveVerifyCommand', () => {
  it('resolves aliases from package.json scripts (mirroring the tool)', () => {
    const dir = scratchDir('b9pv-pkg-');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run', build: 'tsc -p .' } }));
    expect(resolveVerifyCommand({ command: 'test' }, dir)).toBe('npm test');
    expect(resolveVerifyCommand({ command: 'build' }, dir)).toBe('npm run build');
    // Verbatim commands pass through unchanged (classified as-is downstream).
    expect(resolveVerifyCommand({ command: 'echo hi && uname' }, dir)).toBe('echo hi && uname');
  });

  it('fails closed (null) when package.json is unreadable for an alias', () => {
    const dir = scratchDir('b9pv-nopkg-');
    expect(resolveVerifyCommand({ command: 'test' }, dir)).toBeNull();
    // Verbatim commands never need repo detection.
    expect(resolveVerifyCommand({ command: 'echo hi' }, dir)).toBe('echo hi');
  });
});

describe('snapshotTree / rollbackTracked', () => {
  it('snapshots a dirty tree without touching it; rollback restores only what the command introduced', async () => {
    const dir = gitRepo();
    // User dirties b.txt BEFORE verify runs.
    writeFileSync(join(dir, 'b.txt'), 'user edit\n');
    const snap = await snapshotTree(dir);
    expect(snap).not.toBeNull();
    expect(snap!.baselineDirty).toEqual(['b.txt']);
    // Snapshot must not have disturbed the working tree.
    expect(readFileSync(join(dir, 'b.txt'), 'utf8')).toBe('user edit\n');

    // "verify" overwrites both: the user-dirtied file and a clean tracked file.
    writeFileSync(join(dir, 'b.txt'), 'user edit + verify noise\n');
    writeFileSync(join(dir, 'a.txt'), 'verify wrote here\n');
    const r = await rollbackTracked(dir, snap!);
    // BOTH paths restored to their pre-verify content: a.txt from HEAD (clean
    // baseline), b.txt from the snapshot commit (whose tree recorded the
    // user's dirty content at snapshot time) — verify's noise is undone and
    // the user's edit survives.
    expect(r.rolledBack.sort()).toEqual(['a.txt', 'b.txt']);
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('original\n');
    expect(readFileSync(join(dir, 'b.txt'), 'utf8')).toBe('user edit\n');
    // Untracked leftover reporting.
    writeFileSync(join(dir, 'out.js'), 'artifact');
    const r2 = await rollbackTracked(dir, snap!);
    expect(r2.untrackedLeftover).toContain('out.js');
  });

  it('fails closed outside a git repo', async () => {
    // Must be OUTSIDE any git repo: scratch under .revtmp is inside the mochi
    // repo, so use the OS temp dir (left behind deliberately — tiny).
    const dir = mkdtempSync(join(tmpdir(), 'b9pv-nogit-'));
    expect(await snapshotTree(dir)).toBeNull();
  });
});
