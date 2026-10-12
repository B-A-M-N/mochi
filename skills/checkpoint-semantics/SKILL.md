---
name: checkpoint-semantics
description: Git-backed checkpoints and rollback composition — naming, nesting, conflicts, when to auto-commit. Use when touching src/repo/ or checkpoint/rollback flows.
---

# Checkpoint Semantics

Checkpoints are git-backed named snapshots; rollback restores them. Composition rules keep them trustworthy.

## Trigger
- Touching `src/repo/`, checkpoint, rollback, or auto-commit flows.
- Designing a new mutating agent action.

## Steps
1. Every mutating agent action gets an automatic checkpoint BEFORE the mutation (`mochi fix` does this — follow the pattern).
2. Checkpoint names: human-readable intent (`mochi fix`, `mochi commit <msg>`), not timestamps — users read them in `mochi rollback` listings.
3. Rollback is itself checkpointed: a rollback creates a checkpoint of the current state first, so rollback is never destructive-irreversible.
4. Conflicts: if the working tree has changes when restoring, block and tell the user to checkpoint or stash first — never merge silently.
5. Untracked files are included in checkpoints; ignored files are not. Verify with a test that creates both.

## Pitfalls
- Empty commits on no-op checkpoints pollute listings — detect no-op and mark it.
- Nested repos (submodules, vendored clones): operate on the detected project root only.
- `git` absence or corrupt index must degrade to a clear error, never a partial restore.

## Verification
- `npx vitest run src/repo/` green.
- Manual: mutate → rollback → verify tree byte-identical to pre-mutation (checksum), rollback the rollback → original restored.
