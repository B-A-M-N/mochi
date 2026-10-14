---
name: debugging-with-bisect
description: Find the exact commit that introduced a regression using git bisect and a scripted check. Use when a bug appeared "sometime recently" and you need the commit, not a guess.
---
# Debugging Procedure

## Trigger / when to use
Load when you know a bug is a regression (it worked at some point), you have a rough good/bad range, and guessing the cause has already failed once.

## Approach
1. **Automate the verdict first**: the bug must be expressible as a command that exits 0 (good) or non-zero (bad) — a test, a grep, a build. "It looks wrong" cannot be bisected.
2. **Mark the endpoints**: `git bisect start; git bisect bad <now>; git bisect good <known-good>`. If you do not know a good commit, bisect from a tag or a date.
3. **Let the machine search**: `git bisect run <your-check>` finds the offending commit in log(n) steps. Never eyeball commits manually — that is what bisect is for.
4. **Read the offending commit, not around it**: the bisected commit IS the cause. Read its diff fully; the regression is in there, even if it looks innocent.
5. **Fix forward with a regression test**: add a test that fails on the old commit and passes on your fix, so the regression cannot return.

## Pitfalls
- Bisecting a bug that is not deterministic (flaky) — you will "find" a random commit.
- A check that itself has setup side effects, poisoning later bisect steps.
- Stopping at "this commit looks guilty" before bisect actually names it.

## Verification
`git bisect run` names a specific commit; that commit's diff contains a plausible mechanism for the bug; a regression test now covers the failure and passes on your fix.
