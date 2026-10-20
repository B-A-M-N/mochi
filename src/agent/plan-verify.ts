// B9 restructure (plan-mode verify): plan mode vetoes every mutating tool,
// which made `verify` unusable for research (running the project's own
// checks against the current tree). This module restores the research intent
// WITHOUT giving up the containment invariant: a verify command executed in
// plan mode runs against a recorded tree snapshot, and any TRACKED-file
// modification it leaves behind is rolled back before the loop continues.
//
// Mechanics (git-based, tree-untouched at snapshot time):
//  - snapshotTree(): `git stash create` records the current tracked state as
//    a dangling commit WITHOUT touching the working tree (null when clean);
//    plus a baseline of tracked-dirty paths (so the rollback never discards
//    changes the USER had before verify ran).
//  - rollbackTracked(): after the command, any tracked file now dirty that
//    was NOT dirty in the baseline is restored from the snapshot (or from
//    HEAD when the tree was clean). Untracked leftovers are reported, not
//    deleted (they may predate verify via the untracked baseline).
//
// Fail-closed contract: callers must veto verify in plan mode when this
// module cannot establish a snapshot (non-git workspace, git errors).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const execFileAsync = promisify(execFile);

/** Resolve the command a `verify` tool call WILL RUN, mirroring
 *  tools/verify.ts's alias handling (`command` can be a repo-derived alias —
 *  test/build/typecheck/lint — or an arbitrary shell string). Returns null
 *  when the resolution cannot be made statically (no/unparseable
 *  package.json for an alias): the caller must then fail closed. Note: this
 *  intentionally does NOT model the targeted-tests narrowing (scope:"auto"
 *  substitutes a related-tests-only command) — that path is a SUBSET of the
 *  same test-command family, which the alias classification already covers;
 *  and a `target` arg only ever APPENDS to the command, which cannot lower
 *  its risk class. */
export function resolveVerifyCommand(args: Record<string, unknown>, cwd: string): string | null {
  const cmdType = String(args.command ?? 'test');
  if (cmdType === 'auto' || cmdType === '' || cmdType === 'test' || cmdType === 'build' || cmdType === 'typecheck' || cmdType === 'lint') {
    // Repo-derived alias: read package.json scripts the way repo detection
    // does, mirroring the tool's own fallbacks.
    try {
      const pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8')) as {
        scripts?: Record<string, string>;
        packageManager?: string;
      };
      const pm = pkg.packageManager?.split('@')[0]
        || (existsSync(resolve(cwd, 'bun.lockb')) || existsSync(resolve(cwd, 'bun.lock')) ? 'bun' : 'npm');
      if (cmdType === 'auto') {
        // Tool behavior: repo.testCommand || 'echo ...' — with scripts present
        // the test command is `<pm> test`; without, classify the echo (safe).
        return typeof pkg.scripts?.test === 'string' ? `${pm} test` : 'echo "No test command detected"';
      }
      if (cmdType === 'test') return pkg.scripts?.test ? `${pm} test` : 'npm test -- --run';
      if (cmdType === 'build') return pkg.scripts?.build ? `${pm} run build` : 'npm run build';
      if (cmdType === 'typecheck') return 'npx tsc --noEmit';
      return pkg.scripts?.lint ? `${pm} run lint` : 'npx eslint .';
    } catch {
      return null; // package.json unreadable → not statically resolvable
    }
  }
  // Verbatim command: classify exactly what will run.
  return cmdType;
}

export interface PlanVerifySnapshot {
  /** Dangling commit SHA from `git stash create`, or null for a clean tree. */
  sha: string | null;
  /** Tracked paths that were ALREADY dirty before the command ran. */
  baselineDirty: string[];
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', root, ...args], {
    timeout: 15_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

function trackedDirtyPaths(porcelain: string): string[] {
  // porcelain v1: XY<space>path — untracked (??) rows excluded (tracked-only).
  return porcelain
    .split('\n')
    .filter((l) => l.length > 3 && !l.startsWith('??'))
    .map((l) => l.slice(3).trim())
    .filter(Boolean);
}

export async function snapshotTree(root: string): Promise<PlanVerifySnapshot | null> {
  try {
    // `git rev-parse --is-inside-work-tree` fails outside a repo.
    const inside = (await git(root, ['rev-parse', '--is-inside-work-tree'])).trim();
    if (inside !== 'true') return null;
    const sha = (await git(root, ['stash', 'create'])).trim() || null;
    const porcelain = await git(root, ['status', '--porcelain', '--untracked-files=no']);
    return { sha, baselineDirty: trackedDirtyPaths(porcelain) };
  } catch {
    return null; // fail closed: caller must veto without a snapshot
  }
}

/** Roll back tracked-file modifications the verify command left behind.
 *  EVERY tracked path dirty after the command is restored to its PRE-VERIFY
 *  content: paths dirty in the baseline from the snapshot commit (whose tree
 *  records the exact working-tree content at snapshot time), clean-baseline
 *  paths from HEAD. Returns the restored paths plus untracked leftovers
 *  (reported only — they may predate the command). */
export async function rollbackTracked(
  root: string,
  snap: PlanVerifySnapshot,
): Promise<{ rolledBack: string[]; untrackedLeftover: string[] }> {
  try {
    const porcelain = await git(root, ['status', '--porcelain']);
    const nowDirty = trackedDirtyPaths(porcelain);
    const untrackedLeftover = porcelain
      .split('\n')
      .filter((l) => l.startsWith('??') && l.length > 3)
      .map((l) => l.slice(3).trim());
    for (const p of nowDirty) {
      // Snapshot SHA carries the pre-command content of dirty paths; a clean
      // baseline restores from HEAD.
      const src = snap.sha ?? 'HEAD';
      await git(root, ['checkout', src, '--', p]);
    }
    return { rolledBack: nowDirty, untrackedLeftover };
  } catch {
    // Rollback itself failed — report total, honest failure.
    return { rolledBack: [], untrackedLeftover: ['ROLLBACK FAILED — manual git inspection required'] };
  }
}
