---
name: data-modeling
description: Model data for change — normalization tradeoffs, keys and invariants, evolution strategies, and choosing schemas that survive growth. Use when designing databases, file formats, or data contracts.
---
# Data Modeling Procedure

## Trigger / when to use
Load when designing a schema, choosing storage, adding a migration path, or when queries get slow and inserts get rigid — the classic signs of a model that fought its own growth.

## Approach
1. **Start from the queries**: every table exists to answer a question; write the 5-10 real queries first, then model to serve them. A model designed from abstract entities always misses an access pattern.
2. **Identify entities, keys, and invariants**: what uniquely identifies a row, what must always hold (a user has ≥1 email, an order totals its lines), and which invariants the store can enforce vs which the code must.
3. **Normalize until it hurts, denormalize until it works**: third normal form by default (no duplicated data), but deliberately copy hot values that are expensive to join — and record that the copy exists so staleness bugs are findable.
4. **Plan the evolution**: every schema will change; choose the migration strategy now (additive columns, expand-then-contract, versioned documents) rather than discovering it during the incident.
5. **Type the data honestly**: dates as dates, money as integers (cents) or decimals — never floats, enums as constrained sets, nulls only where "absent" is genuinely a distinct state.

## Pitfalls
- Storing computed values without recording they're derived — every read now has two sources of truth.
- Using a string where an enum or a reference belongs — validation becomes a grep.
- Modeling for hypothetical future scale you can't name — the model for 10k rows designed like 10M is unusable.
- Migrations that rewrite data inline without a rollback plan.

## Verification
Write the top queries as real SQL against the model and check they're expressible without string parsing or N+1 joins. Prove one migration forward and back. Assert invariants either in the schema (constraints) or in a test that breaks when they do.
