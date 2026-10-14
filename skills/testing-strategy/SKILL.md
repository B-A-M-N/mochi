---
name: testing-strategy
description: Decide what to test and how much — the test pyramid, risk-based coverage, and where each kind of test earns its cost. Use when planning tests for a system or pushing back on "100% coverage".
---
# Test Strategy

## Trigger / when to use
Load when planning a test suite for a system, when deciding where to spend limited testing effort, or when coverage numbers are being used as a bludgeon.

## Approach
1. **Respect the pyramid**: many fast unit tests at the bottom, fewer integration tests, a handful of end-to-end tests at the top. An inverted pyramid (mostly E2P) is slow and flaky and will be deleted under deadline.
2. **Test by risk, not by line count**: critical paths, money, auth, and data loss get the most tests; one-off scripts get the least. Coverage of a trivial getter is noise.
3. **Match the test to the seam**: units for logic, contracts for APIs, integration for the database boundary, smoke tests for the deploy. A test at the wrong seam gives false confidence.
4. **Treat the suite as a product**: tests are maintained, kept fast, and deleted when the feature goes. A suite nobody runs is worse than none.
5. **Let mutation testing arbitrate**: coverage says what was executed; mutation testing says whether the tests would catch a bug. Use both.

## Pitfalls
- Chasing 100% coverage as a goal rather than a signal.
- End-to-end tests for logic that a unit test would catch in milliseconds.
- Tests so coupled to implementation that every refactor is a test rewrite.

## Verification
The suite has a clear pyramid shape with fast units dominating; every critical path has a test at the right seam; mutation testing confirms the tests catch injected bugs; the suite runs in minutes, not hours.
Run the suite and time it; check the pyramid shape (units dominate, E2P few) and confirm mutation testing catches an injected bug.
