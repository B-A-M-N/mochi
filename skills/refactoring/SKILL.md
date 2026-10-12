---
name: refactoring
description: Refactor code safely without behavior change — seam identification, test-first refactoring, strangler-fig decomposition, and rename/move mechanics. Use when improving structure, reducing duplication, decomposing a large file/module, or untangling legacy code.
---

# Refactoring Procedure

Behavior stays identical, structure improves measurably. If tests break and the fix isn't mechanical, you changed behavior — stop and reassess.

## 1. Pin behavior before moving anything
- Tests first: every behavior you might touch needs a characterization test BEFORE refactoring starts. No test = you're not refactoring, you're rewriting on hope.
- Characterization tests for legacy code: capture CURRENT output (even if wrong-looking) as the golden master; fixing the wrongness is a separate, deliberate change.
- One refactor per commit, green between every commit. The diff that mixes "moved" with "changed" is unreviewable.

## 2. Find the seam (where to cut)
- Duplication: 3+ occurrences before abstracting (rule of three) — earlier abstraction usually cements the WRONG abstraction.
- Coupling smells as refactoring targets: imports from deep internals, feature flags checked at 5 layers, god-objects with >7 responsibilities, files >500 lines mixing abstraction levels.
- The seam is where a change in the future would require touching multiple places today. Cut where the change will land.

## 3. Mechanics (safe micro-steps)
- Rename/move: do it with tooling (LSP rename, codemod), never sed across a codebase — dynamic references (string keys, DI containers) don't grep.
- Extract function: cut-paste the body, run tests, THEN adjust parameters — compile errors first, understanding second.
- Inline-then-extract when the current split is wrong: collapse it to one place, then re-cut along the correct seam.
- Strangler fig for big pieces: new implementation takes a slice of traffic (flag or adapter), parity-verified, old path deleted after a soak period. No big-bang rewrites.

## 4. Measures of success (declare before starting)
- A number must improve: lines in the god file, fan-in/fan-out of the module, cyclomatic complexity, or time-to-add-the-next-feature. "Cleaner" is not a result.
- Public surface shrinks or stays identical — a refactor that grows the API made everything harder for everyone downstream.

## 5. Stop conditions
- Two failed attempts at the same extraction: the design you're refactoring TOWARD is wrong. Step back and sketch the target shape before continuing.
- If a refactor needs >1 working session, stage it: land the seams and tests now, the moves next.

## Pitfalls
- Refactoring and bug-fixing in one PR: reviewers can't verify either. The bug fix lands on the refactored code as its own change.
- Abstracting too early (two call sites, speculative interface): duplication is cheaper than the wrong abstraction — wait for the third.
- Test refactors that re-implement the implementation (asserting mocks called in order): such tests pin structure, not behavior, and will fight every future refactor.
