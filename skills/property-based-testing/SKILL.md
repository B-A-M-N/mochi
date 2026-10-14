---
name: property-based-testing
description: Test invariants with generated inputs instead of hand-picked examples to find cases you never wrote. Use for parsers, serializers, math and round-trip guarantees.
---
# Property-based Testing Procedure

## Trigger / when to use
Load when testing encode/decode, idempotence or algebraic properties, or example suites with many cases that still miss bugs.

## Approach
1. **Find invariants** (round-trip, idempotence, preservation, oracle) instead of examples.
2. **Define generators for the valid domain** (non-empty lists, valid dates); do not test out-of-contract junk.
3. **Shrink automatically**, pin the minimized counterexample after fixing.
4. **Complement examples**, do not replace them - both keep their roles.
5. **Budget the run**: thousands of fast cases; deterministic seed in CI.

## Pitfalls
- Fixing only the shrunken trivial case, not the general invariant.
- Generators wider than the domain producing false "failures".
- Shared mutable state across trials.

## Verification
One property catches a bug no example caught. Shrunken case pinned as a regression example.
