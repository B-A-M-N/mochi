---
name: typescript-strictness
description: Use the type system to prevent bugs at compile time — discriminated unions, satisfies, exhaustive switches, and avoiding any/unknown leaks. Use when writing TypeScript that must be correct by construction.
---
# TypeScript Strictness Procedure

## Trigger / when to use
Load when modeling data with variants, adding validation for external input, reaching for `any`/`as`, or fixing TypeScript errors by weakening types instead of correcting the model.

## Approach
1. **Model variants as discriminated unions**: `{ kind: 'ok', data } | { kind: 'err', err }` — the compiler forces handling of every case at every consumer, and `switch (x.kind)` becomes exhaustive-checkable.
2. **Make invalid input unrepresentable**: parse at the boundary into a typed shape (`unknown` → validated domain object). Never cast external JSON with `as` — you're asserting your wishes to the compiler, not verifying them.
3. **`satisfies` for literal configs, `as const` for literals**: `const routes = [...] satisfies Route[]` keeps inference precise while enforcing shape — better than `as Route[]`, which erases what you actually wrote.
4. **Exhaustive switches with `never`**: end the switch with `default: { const _x: never = x; throw ... }` — adding a variant then fails the build at every place that must handle it, which is the whole point.
5. **`unknown` at edges, narrow immediately**: accept `unknown` from the outside world, validate into a type, then use that type internally. `any` disables checking everywhere it flows — the single most expensive escape hatch.

## Pitfalls
- `as any` to silence an error — the error was telling you the truth about your model.
- Non-null assertions (`!`) on values that genuinely can be null — you've moved the crash to a random future place.
- Overloaded string unions (`type Status = string`) — a union of one literal is the union that enforces nothing.
- Type gymnastics that need `as` to escape — when the fight is hard, the model is wrong, not the language.

## Verification
Run `tsc --noEmit` with strict flags (noUncheckedIndexedAccess where feasible) and grep the diff for new `any`, `as `, and `!` — each must have a comment justifying why the compiler genuinely cannot know. Exhaustive switches should break the build when a variant is added; test that by adding one temporarily.
