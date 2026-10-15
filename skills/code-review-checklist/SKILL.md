---
name: code-review-checklist
description: Review code for the defects that actually reach production — correctness, security, and maintainability — not style. Use when reviewing a PR, a diff, or your own changes before declaring done.
---
# Code Review Checklist Procedure

## Trigger / when to use
Load when reviewing any code change — a teammate's PR, your own diff before commit, or a self-review pass. The goal is to catch the defects that matter, not to enforce taste.

## Approach
1. **Correctness first**: trace the happy path AND the edges — empty, null, max, duplicate, concurrent, and failure inputs. Most production bugs are edge cases the author did not run.
2. **Security second**: injection (SQL, command, path), auth bypass, secret leakage, unsafe deserialization, and unchecked user input. A correctness bug costs a feature; a security bug costs trust.
3. **Failure behavior**: what happens when the dependency is down, the input is malformed, or the operation is retried? Silent success on failure is worse than a loud error.
4. **Maintainability last**: naming, structure, and test coverage — but only where the change makes the code harder to change later. Style nits are not review comments.
5. **Verify, do not trust**: run the tests, read the diff, check the call sites. A review that does not run the code is a guess with extra steps.

## Pitfalls
- Reviewing the diff instead of the system — the bug is often in the interaction the diff does not show.
- Nitpicking style while missing the off-by-one in the loop.
- Approving because "it looks right" without running anything.

## Verification
Every correctness edge, security concern, and failure path has an explicit verdict; the tests were run; the review distinguishes blocking issues from suggestions.
