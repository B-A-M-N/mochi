---
name: feature-flags
description: Implement feature flags and gradual rollouts — flag taxonomy, kill switches, percentage rollouts, targeting rules, and flag-debt hygiene. Use when adding a feature toggle system, doing a risky rollout, or cleaning up flag sprawl.
---

# Feature Flags Procedure

Flags decouple deploy from release — the practice that makes trunk-based development safe. Mismanaged, they become config debt that outlives the features they launched.

## 1. Flag taxonomy (name the lifespan up front)
- **Release flags** (days-weeks): hide unfinished work on main. Kill-by date set at creation.
- **Operational flags** (kill switches): instant-off for a risky dependency/feature. Long-lived BY DESIGN, tested monthly (a kill switch that's never been flipped is untested).
- **Experiment flags** (A/B): defined by an experiment end date and a metric.
- **Entitlement flags** (per-customer features): permanent, targeting-driven.
- The taxonomy matters because the CLEANUP rule follows the class: release flags die in weeks; entitlement flags get reviewed annually; nothing else survives a quarter.

## 2. Architecture (in-house vs vendor)
- Vendor (LaunchDarkly/Flagsmith-class) when: multi-service, non-engineering targeting rules, or experiments with stats. In-house when: one app, simple boolean rollout — a cached JSON of flags + an admin endpoint is a complete system; don't vendor a $50k product for 12 booleans.
- Evaluation order must be deterministic: env default -> user/tenant targeting -> percentage bucket (hash user-ID, not random) -> code default. The SAME user gets the SAME variant every time (random buckets = support-ticket generator).
- Flags resolved at ONE boundary (a flags hook/context) and injected — flag reads scattered through components make rollout state unknowable.

## 3. The rollout ladder (never 0->100)
- 1% (canary: errors/latency watch) -> 10% (support-ticket watch) -> 50% -> 100%, with a bake period per step and an automatic rollback trigger tied to the metrics that matter for THIS feature.
- Targeted-first: employees/internal flag -> friendly customers -> everyone. "Dogfood before rollout" is the cheapest QA tier.
- Database/backfills behind flags too: schema changes ship flagged so the flag-off path still works — a flag that can't turn off after its schema landed isn't a flag, it's a requirement.

## 4. Flag-debt hygiene (the part everyone skips)
- Every flag registered with: owner, type, creation date, and intended removal date. The registry is queryable (a dashboard or a lint rule: flags older than X alert their owner).
- Removal is part of the feature's definition-of-done: flag ON becomes the only path, then the flag code deletes in the next PR. "We'll clean it up later" is how repos accumulate 400 flags nobody owns.
- Flag naming convention: `team.feature.variant` — grep-able and self-documenting; `newCheckout2` is archaeology.

## 5. Verify
- Both paths tested: flag ON and flag OFF in CI (matrix test on the flag) — the off-path rots silently otherwise, and then the kill switch is a dead man's handle.
- Kill-switch drill: flip it off in staging, confirm the system degrades gracefully (no error storms, no half-rendered UI).
- Flag resolution observability: log flag->variant per request ID (sampled) — when a rollout misbehaves, "which variant was user X on" must be answerable in one query.

## Pitfalls
- Percentage by RANDOM per request: users see features flicker on/off. Bucket by stable ID.
- Flags used for long-running divergence (two codebases in one repo behind a flag): after a quarter, delete one side or ship it — permanent divergence is a fork you're paying interest on.
- Default-on in code AND flag-on in config with different semantics: one source of truth per flag; the code default is only the fallback when config is absent.
