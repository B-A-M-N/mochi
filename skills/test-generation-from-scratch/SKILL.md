---
name: test-generation-from-scratch
description: Write tests for code that has none — boundary analysis, table-driven cases, and property checks. Use when adding tests to untested code or increasing coverage meaningfully.
---
# Test Generation Procedure

## Trigger / when to use
Load when asked to add tests to untested code, raise coverage, or when a module is important enough that its absence of tests is a liability.

## Approach
1. **Map the contract before the cases**: what does the function promise (preconditions, postconditions, errors)? Tests are the contract made executable — start there.
2. **Cover the boundaries, not the middle**: 0, 1, empty, max, null, duplicates, unicode, and the exact off-by-one. Most bugs live on edges; middle cases are theater.
3. **Include the failure paths**: every throw, every error return, every guard clause. Untested error handling is how production surprises you.
4. **Prefer table-driven tests**: one test function over a table of {input, expected} beats ten copy-pasted tests and makes the next case free.
5. **Assert behavior, not implementation**: test the return value and side effects, never private fields or call order. Implementation-coupled tests break on every refactor.

## Pitfalls
- Testing getters/setters and other tautologies — coverage theater that finds nothing.
- Mocking so much that the test verifies the mock, not the code.
- Asserting only the happy path and calling it "covered".

## Verification
Mutation testing passes: injecting a plausible bug into the code makes at least one test fail. If your tests survive a bug, they were not testing anything.
