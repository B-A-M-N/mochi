---
name: git-workflow
description: Safe git procedures - checkpoints, inspecting history, branches, rebases, merge conflicts, and what never to do without approval. Use for any git operation beyond plain status/diff, including resolving conflicts and restructuring commits.
---

# Git Workflow

## Reading (always safe)
- `git status --short`, `git diff` — current state.
- `git log --oneline -n`, `git blame <file>`, `git show <sha>` — history.
- The `git_log` / `git_blame` tools wrap these with useful defaults.

## Checkpoints
- The harness snapshots state before edits. If you break something and can't fix forward, say so — do NOT `git checkout .` to "get back".
- Prefer small commits when working for a long time: stage only your files (`git add <paths>`), commit with a message saying what and why.

## Never without explicit user approval
- `git push --force` / `-f` variants
- `git reset --hard`, `git checkout -- .`, `git clean -fd`
- deleting branches, rewriting history on shared branches
- pushing to remotes at all, unless the user asked

## Branches
- New work in a repo with a clean tree: branch first when the change is large or experimental.
- Name branches after intent: `fix-null-token`, `feat-crawl-tool`.

## Recovering
- Accidental commit: `git reset --soft HEAD~1` (keeps changes).
- Wrong branch: `git stash`, switch, `git stash pop`.
- Conflicted rebase/merge: read `git status`, resolve each file with `edit`, `git add` it, continue. Never resolve by deleting the other side blindly.

## Merge Conflict Resolution

1. `git status` to list conflicted files; `git diff` to see markers.
2. For each file: resolve `<<<<<<< ======= >>>>>>>` blocks — keep both sides when they serve different purposes, prefer upstream intent otherwise.
3. `git add <file>` per resolved file; never `git add .` blind during a conflict.
4. When history restructuring is involved (`rebase`), verify with `git log --oneline` that the intended shape survived before continuing.
5. Aborted conflicts: `git rebase --abort` / `git merge --abort` restores the pre-operation checkpoint state.
