---
name: regression-test-on-fix
description: When you fix a bug, write a regression test that fails on the old code and passes on the fix — so the bug can never return. Use after fixing any bug or defect.
---
# Regression Test on Fix Procedure

## Trigger / when to use
Load immediately after fixing a bug — before you declare the task done. A fix without a regression test is a fix that will quietly return.

## Approach
1. **Reproduce first**: write the smallest test that fails on the buggy code. Run it against the old code to confirm it fails for the RIGHT reason (the bug, not a setup error).
2. **Fix, then confirm green**: apply the fix, run the new test, confirm it passes. The test must transition red→green; a test that was always green is not a regression test.
3. **Test the mechanism, not the symptom**: assert the correct behavior the bug violated, not just "does not crash". A test that only checks the crash returns when the crash is replaced by a wrong answer.
4. **Keep it minimal and fast**: the regression test joins the permanent suite — it must run in milliseconds and need no special setup.
5. **Name it for the bug**: `test_<thing>_does_not_<regression>` or `test_<thing>_handles_<edge>`. The name is the next reader's map to the bug.

## Pitfalls
- Writing the test after the fix from memory of the bug — you will test the fix, not the bug.
- A test so broad it fails for unrelated reasons and gets deleted.
- Testing the symptom (the crash) instead of the invariant (the correct result).

## Verification
The test fails when you revert the fix (red) and passes with the fix (green); it runs in under a second; it asserts the correct behavior, not just the absence of a crash.
