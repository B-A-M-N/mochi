---
name: mocking-strategies
description: Use test doubles deliberately — what to mock, what never to mock, and how to avoid tests that verify the mock. Use when writing unit tests with dependencies.
---
# Mocking Strategies Procedure

## Trigger / when to use
Load when writing unit tests that touch databases, HTTP, clocks, or other services, and the question is what to replace and what to keep real.

## Approach
1. **Mock at the boundary, not the collaborator**: replace the database client, the HTTP service, the clock — the seams your code does not own. Never mock the class under test or its value objects.
2. **Prefer fakes over mocks when possible**: an in-memory repository is simpler, more honest, and tests behavior rather than call order. Reach for mocks only for true third-party boundaries.
3. **Stub returns, verify outcomes**: set up what the dependency returns; assert on the result and the important side effects. Verifying "mock.foo was called twice" tests the mock, not the code.
4. **Never mock what you do not own**: mocking a library's internals couples the test to its implementation and breaks on every upgrade.
5. **Keep the double honest**: the mock's contract must match the real dependency's. A mock that returns success while the real service would fail is a lie that hides the failure path.

## Pitfalls
- Mocking the system under test to make it "isolated".
- Deep mock chains that recreate the object graph and test nothing.
- Mocks that hide the failure path the test exists to cover.

## Verification
Every test double sits at an ownership boundary; the test asserts outcomes, not call sequences; swapping the fake for the real dependency (in an integration test) still passes.
