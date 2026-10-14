---
name: flaky-test-debugging
description: Diagnose and eliminate flaky tests — find shared state, timing dependence, and order coupling, then make them deterministic. Use when a test passes locally and fails in CI, or fails randomly.
---
# Flaky Test Debugging Procedure

## Trigger / when to use
Load when a test fails intermittently, passes on rerun, fails only in CI or only in parallel, or when "just rerun it" has become the team's answer.

## Approach
1. **Gather the failure evidence**: the pass/fail pattern across runs (random? every Nth? only parallel?) and the full output — not just the assertion. Timing failures point at concurrency; state failures point at sharing.
2. **Reproduce with volume**: run the test 50-100 times locally or with the CI runner's parallelism. A flake you can't reproduce on demand still shows patterns under repetition.
3. **Bisect by isolation**: run it alone (rules out shared state), run it with others (reproduces coupling), then vary the order. Each result eliminates half the hypothesis space.
4. **Find the root coupling**: shared mutable state between tests, dependence on wall-clock or ordering, unawaited async work, real network, or filesystem leftovers. Name the exact mechanism before fixing.
5. **Fix the cause, not the symptom**: seed injected clocks, isolate state per test, await every promise, stub the network. Retry-on-failure hides the flake and lets its cause spread.

## Pitfalls
- Adding `sleep` to make it pass — you've converted a fast flake into a slow one.
- `--retries` in CI as the fix — the failure rate becomes invisible while the bug stays.
- Fixing one test while the shared fixture poisons ten others — look for the common state.
- Marking it skipped "temporarily" — skipped tests quietly become deleted tests.

## Verification
Run the test 100x (or the CI shard's concurrency) with zero failures, and confirm the test asserts the same thing it did before. Then ask what made the flake possible — a global, a singleton, an unawaited promise — and fix that at its source.
