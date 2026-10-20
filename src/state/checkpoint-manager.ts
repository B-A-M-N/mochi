// Named Checkpoint & Surgical Rollback Time-Machine.
// Allows users and agents to save immutable snapshots of working code before risky changes
// and roll back cleanly to named points in time without losing work outside the project.

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runArgv } from '../exec.js';
import { mochiStateDir } from '../core/mochi-dir.js';
import { atomicWriteFileSync } from '../core/atomic-fs.js';

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

/** Git calls run through the central exec policy (argv-only, timeout, output
 *  cap). The raw diff gets a generous 32MB cap: a truncated patch is a
 *  CORRUPT patch — silent truncation is exactly the bug class that once made
 *  every saved checkpoint un-restorable. */
const GIT_DIFF_MAX_OUTPUT = 32 * 1024 * 1024;

async function runGit(cwd: string, args: string[]): Promise<string> {
  const res = await runArgv('git', args, { cwd });
  return (res.stdout || '').trim();
}

/** Capture git stdout verbatim (no trim). Patches are whitespace-significant:
 *  trimming the trailing newline produces a patch `git apply` rejects with
 *  "corrupt patch", which silently made every saved checkpoint un-restorable. */
async function runGitRaw(cwd: string, args: string[]): Promise<string> {
  const res = await runArgv('git', args, { cwd, maxOutput: GIT_DIFF_MAX_OUTPUT });
  return res.stdout || '';
}

/** A git patch must end with a newline to be applyable. */
function normalizePatch(patch: string): string {
  if (!patch) return '';
  return patch.endsWith('\n') ? patch : `${patch}\n`;
}

/** Like runGit, but surfaces failures — runGit drops status/stderr, which is
 *  why restore could report success after a `reset --hard` or `apply` that
 *  git had rejected (non-repo, bad sha, patch conflict). */
async function runGitChecked(cwd: string, args: string[]): Promise<{ ok: boolean; out: string; err: string }> {
  const res = await runArgv('git', args, { cwd });
  const ok = res.code === 0 && !res.timedOut && !res.cancelled;
  return { ok, out: (res.stdout || '').trim(), err: ok ? '' : (res.stderr || `git ${args.join(' ')} exited ${res.code}${res.timedOut ? ' (timed out)' : ''}`).trim() };
}

/** Save a named snapshot of current working tree and git state */
export async function saveNamedCheckpoint(
  cwd: string,
  name: string,
  description?: string
): Promise<NamedCheckpoint> {
  const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const dir = getCheckpointsDir(cwd);

  const headSha = (await runGit(cwd, ['rev-parse', 'HEAD'])) || 'uncommitted';
  const patch = normalizePatch(await runGitRaw(cwd, ['diff', 'HEAD']));
  const status = (await runGit(cwd, ['status', '--short'])) || '';

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
  // B20: atomic tmp+rename write. A crash/SIGKILL mid-write used to tear the
  // checkpoint JSON — every later restore of that name threw a raw
  // SyntaxError instead of restoring.
  atomicWriteFileSync(filePath, JSON.stringify(checkpoint, null, 2));
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

  let checkpoint: NamedCheckpoint;
  try {
    checkpoint = JSON.parse(readFileSync(filePath, 'utf8')) as NamedCheckpoint;
  } catch (err) {
    // B20: a torn checkpoint file (crash mid-save) must produce a clean
    // failure, not a raw SyntaxError that crashes `mochi checkpoint restore`.
    return {
      success: false,
      message: `Checkpoint "${name}" is corrupt (unreadable JSON — likely a torn save). It cannot be restored; delete it with \`mochi checkpoint delete ${name}\`. (${err instanceof Error ? err.message : String(err)})`,
    };
  }
  if (!checkpoint || typeof checkpoint !== 'object') {
    return { success: false, message: `Checkpoint "${name}" is corrupt (not a checkpoint object).` };
  }

  // Nothing to restore (e.g. saved outside a git repo: sha 'uncommitted' and
  // an empty patch) — reporting success here was a pure lie.
  if ((!checkpoint.gitCommitSha || checkpoint.gitCommitSha === 'uncommitted') && !checkpoint.patch) {
    return {
      success: false,
      message: `Checkpoint "${checkpoint.name}" has no git state or patch to restore (it was saved outside a git repository).`,
    };
  }

  try {
    // 0. Snapshot the CURRENT dirty state before touching anything. Restore is
    //    transactional: if the checkpoint patch fails to re-apply after the
    //    reset, we can put the user's newer work back exactly as it was. The
    //    old ordering ran `reset --hard` FIRST and attempted the patch second,
    //    so a corrupt/torn patch (a real bug class: silent diff truncation)
    //    destroyed the newer work AND failed the restore.
    let undoPatch = '';
    let oldHead = '';
    if (checkpoint.patch) {
      const snap = await runGitRaw(cwd, ['diff', 'HEAD']);
      if (snap.trim()) {
        undoPatch = normalizePatch(snap);
        // Rollback base: the pre-restore HEAD. A bare `reset --hard` after
        // step 1 would land on the CHECKPOINT sha, and a diff captured
        // against the pre-restore HEAD would then fail to apply.
        // Untracked files need no snapshot: reset --hard and git apply leave
        // them untouched. Staged-but-uncommitted content comes back as
        // worktree content (index staging state is not preserved).
        oldHead = await runGit(cwd, ['rev-parse', 'HEAD']);
      }
    }

    // 1. Reset tracked files to the recorded commit
    if (checkpoint.gitCommitSha && checkpoint.gitCommitSha !== 'uncommitted') {
      const r = await runGitChecked(cwd, ['reset', '--hard', checkpoint.gitCommitSha]);
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
      atomicWriteFileSync(tempPatchPath, normalizePatch(checkpoint.patch));
      const r = await runGitChecked(cwd, ['apply', tempPatchPath]);
      try { unlinkSync(tempPatchPath); } catch {}
      if (!r.ok) {
        // Roll back to the exact pre-restore state instead of leaving the
        // workspace destroyed at the checkpoint commit.
        const undoTemp = resolve(dir, `_undo_${Date.now()}.patch`);
        let restored = false;
        try {
          if (undoPatch && oldHead) {
            writeFileSync(undoTemp, normalizePatch(undoPatch), 'utf8');
            await runGitChecked(cwd, ['reset', '--hard', oldHead]);
            const ur = await runGitChecked(cwd, ['apply', undoTemp]);
            restored = ur.ok;
          }
        } catch { /* fall through to restored=false */ }
        try { unlinkSync(undoTemp); } catch {}
        return {
          success: false,
          message: restored
            ? `Checkpoint "${name}": the stored patch could NOT be re-applied — ${r.err}. The workspace was rolled back to its pre-restore state; nothing was lost.`
            : undoPatch
              ? `Checkpoint "${name}": the stored patch could NOT be re-applied — ${r.err}. Automatic rollback also failed; run \`git reset --hard\` and \`git reflog\` to inspect.`
              : `Checkpoint "${name}": the stored patch could NOT be re-applied — ${r.err}. The tracked tree was reset to the checkpoint commit; the working tree had no uncommitted changes to roll back.`,
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
