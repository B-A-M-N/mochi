---
name: parity-testing
description: Differential testing between Rust native ops and TS fallbacks — property-based cases, adversarial inputs, deterministic seeds. Use when adding native ops or investigating parity drift.
---

# Parity Testing Procedure

The native core must be a drop-in replacement for the TS fallback. Parity tests are the only thing keeping that true.

## Trigger
- New or changed `native/src/` op.
- Parity drift report (native vs TS disagree on some input).
- Before promoting a native op out of shadow mode.

## Steps
1. Enumerate the input space: empty, single element, max realistic size, unicode, invalid UTF-8, negative/NaN/boundary numbers, deeply nested structures.
2. Write a differential test: generate inputs (seeded RNG for determinism), run both implementations, assert deep equality on outputs.
3. For performance-sensitive ops, also assert the *complexity class* hasn't changed (native should not be O(n) where TS was O(1), or vice versa).
4. Mark tests with the op name in the title so drift reports point at the exact op: `describe('parity: <op>')`.
5. Run the suite with the native addon *disabled* (force TS path) — both configurations must pass.

## Pitfalls
- Floating-point: Rust `f64` and JS `Number` are both IEEE 754, but operation order can differ — normalize or assert with epsilon.
- Sorting stability: Rust `sort_unstable` is NOT the same as JS `Array.prototype.sort` (stable). Use stable sorts in Rust.
- String handling: Rust `&str` is UTF-8; JS strings are UTF-16. Test with astral-plane characters (emoji, CJK ext).
- Don't test through the selection layer — test both paths directly.

## Verification
- `npx vitest run src/native/` green with and without the addon loaded.
- Seeded: re-run twice, identical results.
