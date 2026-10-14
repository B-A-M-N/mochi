---
name: writing-stable-tests
description: Write tests that never flaky — deterministic, isolated, and order-independent. Use when writing any test that will run in CI forever.
---
# Stable Test Procedure

## Trigger / when to use
Load when writing or fixing tests, especially ones that will run in CI on every commit and whose failure erodes trust in the whole suite.

## Approach
1. **Determinism first**: no wall-clock dependence (inject the clock), no random without a seed, no reliance on network, filesystem leftovers, or shared global state. A test that can fail for two reasons is a test that will fail for one.
2. **Isolate from other tests**: each test builds and tears down its own state. Shared fixtures must be immutable or reset per test — cross-test contamination is the source of most "works alone" failures.
3. **Make failure obvious**: a failing test should point at the broken behavior, not at a stack trace three frames deep into a harness. Assert the specific value, not "not null".
4. **Fail fast on setup**: if the environment is wrong (no DB, no key), skip with a clear reason or fail loudly — never pass by accident.
5. **Treat flaky tests as bugs, not noise**: a flaky test is a test telling you about a race, a leak, or a hidden dependency. Fix the root; do not quarantine and forget.

## Pitfalls
- `sleep` to "let things settle" — converts a fast flake into a slow one.
- Tests that pass only when run in a specific order.
- Assertions so loose ("did not throw") that they would pass on a no-op.

## Verification
The test passes 100 consecutive runs in CI and locally, including in parallel and in random order; it fails loudly and specifically when the behavior it guards is broken.
