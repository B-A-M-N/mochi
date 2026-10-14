---
name: mutation-testing
description: Measure test suite strength by introducing small code mutations and checking the suite kills them. Use when high coverage still hides weak assertions.
---
# Mutation Testing Procedure

## Trigger / when to use
Load when coverage is high but bugs still escape, when assessing a new test suite's real value, or before declaring a critical area "tested".

## Approach
1. **Generate mutants** in the target code (flipped conditionals, removed lines, math operator swaps).
2. **Run the suite** against each mutant; a killed mutant is one the suite rejects.
3. **Read surviving mutants** - each surviving mutant is either dead logic (remove the code) or a weak test (strengthen the assertion).
4. **Fix tests at the invariant level** so the suite kills the whole mutant's "why" instead of one literal.
5. **Stay in scope**: run on the area whose failure cost is real; whole-repo mutation runs take forever.

## Pitfalls
- Mutation-score obsession overriding judgment: some survivors are intentional redundancy.
- Equivocal mutants that cannot be killed by any test - flag them in source comments.
- Treating a 100% score as zero-bug proof (it measures tests, not logic).

## Verification
Every surviving mutant in the chosen scope is either a documented equivalent mutant or has a strengthened test. Re-run shows improved score.
