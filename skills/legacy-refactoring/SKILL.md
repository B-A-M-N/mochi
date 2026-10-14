---
name: legacy-refactoring
description: Safely refactor legacy code that has no tests — characterization tests, golden masters, and small reversible steps. Use when improving or cleaning up old, untested code.
---
# Legacy Refactoring Procedure

## Trigger / when to use
Load when asked to refactor, clean up, or modernize legacy code that ships without a safety net, and a careless change would be invisible until production.

## Approach
1. **Characterize before you change**: write tests that pin the code's CURRENT behavior, bugs included. A characterization test is not a spec — it is a photograph. If you cannot photograph it, you do not understand it.
2. **Get a safety net cheaply**: if unit tests are impossible, use a golden-master (snapshot I/O) or approval test over real inputs. Any net beats no net.
3. **Refactor in tiny, reversible steps**: one small transformation per commit, each keeping the characterization green. Never bundle a behavior change with a pure refactor.
4. **Preserve behavior exactly — then change it separately**: refactor to green, commit; then change behavior, commit. A PR that does both is unreviewable.
5. **Delete dead code as you find it**: the cheapest refactor is removal. If it is truly unreferenced, delete it; if it was kept "just in case", it was already dead weight.

## Pitfalls
- Refactoring and feature work in the same commit — the bug report will blame the refactor.
- "Improving" behavior while refactoring — you have now changed two things and can only test one.
- Rewriting from scratch because "it is easier" — you will re-introduce the old bugs and add new ones.

## Verification
The characterization suite passes before and after every refactor step; the diff of a pure refactor changes structure but not observable behavior; each step is a commit you can revert independently.
