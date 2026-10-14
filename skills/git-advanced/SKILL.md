---
name: git-advanced
description: Advanced git for investigation and repair — bisect, reflog recovery, history surgery, and conflict strategies. Use when finding a regression, recovering lost work, or cleaning history.
---
# Advanced Git Procedure

## Trigger / when to use
Load when hunting "when did this break", recovering from a bad reset/rebase, cleaning up a messy branch before review, or resolving conflicts that simple tools mangle.

## Approach
1. **Bisect before guessing**: `git bisect start; git bisect bad; git bisect good <known-good>` with a scripted check (`git bisect run`) finds the breaking commit in log(n) instead of eyeballing history.
2. **Reflog is your safety net**: `git reflog` keeps unreachable commits for ~90 days — a bad `reset --hard`, failed rebase, or deleted branch is recoverable. Nothing is truly lost until gc.
3. **Surgery with intent**: interactive rebase for reordering and rewording, `git commit --fixup` + `autosquash` for late fixes, `filter-repo` (not filter-branch) for history-wide rewrites. Never rewrite shared branches.
4. **Resolve conflicts at the right level**: understand what both sides intended before choosing; `git checkout --ours/--theirs` is for regenerable files, and `diff3` conflict style shows the base so you can reason about who changed what.
5. **Verify before publishing**: after any rewrite, run the build/tests on the result, and diff against the pre-rewrite tip — `git diff ORIG_HEAD` shows exactly what the surgery changed.

## Pitfalls
- Force-pushing shared branches — the recovery cost lands on everyone who pulled.
- `reset --hard` without checking `reflog` first — the work is usually still there.
- Filtering history on a repo others have cloned without coordination.
- Bisecting without a reliable good/bad anchor — a wrong anchor inverts every conclusion.

## Verification
After recovery or surgery: the working tree builds and tests pass, `git reflog` shows the operation, and the diff against the original state contains only intended changes. For bisects, confirm the blamed commit actually contains the failing change.
