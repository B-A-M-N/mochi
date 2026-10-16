// Named Checkpoint & Surgical Rollback Time-Machine.
// Allows users and agents to save immutable snapshots of working code before risky changes
// and roll back cleanly to named points in time without losing work outside the project.

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mochiStateDir } from '../core/mochi-dir.js';

export interface NamedCheckpoint {
  name: string;
  description?: string;
  createdAt: string;
  gitCommitSha: string;
  patch: string;
  affectedFiles: string[];
}

function getCheckpointsDir(cwd: string): string {
  const dir = resolve(mochiStateDir(cwd), 'checkpoints');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function runGit(cwd: string, args: string[]): string {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return (res.stdout || '').trim();
}

/** Like runGit, but surfaces failures — runGit drops status/stderr, which is
 *  why restore could report success after a `reset --hard` or `apply` that
 *  git had rejected (non-repo, bad sha, patch conflict). */
function runGitChecked(cwd: string, args: string[]): { ok: boolean; out: string; err: string } {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.error) return { ok: false, out: (res.stdout || '').trim(), err: String(res.error.message) };
  const ok = res.status === 0;
  return { ok, out: (res.stdout || '').trim(), err: ok ? '' : (res.stderr || `git ${args.join(' ')} exited ${res.status}`).trim() };
}

/** Save a named snapshot of current working tree and git state */
export async function saveNamedCheckpoint(
  cwd: string,
  name: string,
  description?: string
): Promise<NamedCheckpoint> {
  const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dir = getCheckpointsDir(cwd);

  const headSha = runGit(cwd, ['rev-parse', 'HEAD']) || 'uncommitted';
  const patch = runGit(cwd, ['diff', 'HEAD']) || '';
  const status = runGit(cwd, ['status', '--short']) || '';

  const affectedFiles = status
    .split('\n')
    .map((l) => l.slice(3).trim())
    .filter(Boolean);

  const checkpoint: NamedCheckpoint = {
    name: cleanName,
    description: description || `Checkpoint created at ${new Date().toLocaleTimeString()}`,
    createdAt: new Date().toISOString(),
    gitCommitSha: headSha,
    patch,
    affectedFiles,
  };

  const filePath = resolve(dir, `${cleanName}.json`);
  writeFileSync(filePath, JSON.stringify(checkpoint, null, 2), 'utf8');
  return checkpoint;
}

/** List all available saved checkpoints */
export function listNamedCheckpoints(cwd: string): NamedCheckpoint[] {
  const dir = getCheckpointsDir(cwd);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const checkpoints: NamedCheckpoint[] = [];

  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(resolve(dir, f), 'utf8')) as NamedCheckpoint;
      if (data && data.name) checkpoints.push(data);
    } catch {}
  }

  // Sort by createdAt descending
  return checkpoints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Restore the working tree to a saved named checkpoint */
export async function restoreNamedCheckpoint(
  cwd: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dir = getCheckpointsDir(cwd);
  const filePath = resolve(dir, `${cleanName}.json`);

  if (!existsSync(filePath)) {
    return { success: false, message: `Checkpoint "${name}" not found.` };
  }

  const checkpoint = JSON.parse(readFileSync(filePath, 'utf8')) as NamedCheckpoint;

  // Nothing to restore (e.g. saved outside a git repo: sha 'uncommitted' and
  // an empty patch) — reporting success here was a pure lie.
  if ((!checkpoint.gitCommitSha || checkpoint.gitCommitSha === 'uncommitted') && !checkpoint.patch) {
    return {
      success: false,
      message: `Checkpoint "${checkpoint.name}" has no git state or patch to restore (it was saved outside a git repository).`,
    };
  }

  try {
    // 1. Reset tracked files to the recorded commit
    if (checkpoint.gitCommitSha && checkpoint.gitCommitSha !== 'uncommitted') {
      const r = runGitChecked(cwd, ['reset', '--hard', checkpoint.gitCommitSha]);
      if (!r.ok) {
        return {
          success: false,
          message: `Failed to restore checkpoint "${name}": git reset --hard rejected — ${r.err}`,
        };
      }
    }

    // 2. If there was a dirty working tree patch, re-apply it cleanly
    if (checkpoint.patch) {
      const tempPatchPath = resolve(dir, `_temp_${Date.now()}.patch`);
      writeFileSync(tempPatchPath, checkpoint.patch, 'utf8');
      const r = runGitChecked(cwd, ['apply', tempPatchPath]);
      try { unlinkSync(tempPatchPath); } catch {}
      if (!r.ok) {
        return {
          success: false,
          message: `Checkpoint "${name}": commit restored, but the working-tree patch could NOT be re-applied — ${r.err}`,
        };
      }
    }

    return {
      success: true,
      message: `Restored workspace to checkpoint "${checkpoint.name}" (${new Date(checkpoint.createdAt).toLocaleString()}).`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to restore checkpoint "${name}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Delete a saved checkpoint */
export function deleteNamedCheckpoint(cwd: string, name: string): boolean {
  const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dir = getCheckpointsDir(cwd);
  const filePath = resolve(dir, `${cleanName}.json`);
  if (!existsSync(filePath)) return false;
  try {
    unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}
