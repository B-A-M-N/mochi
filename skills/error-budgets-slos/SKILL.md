---
name: error-budgets-slos
description: Run reliability with error budgets and SLOs — define targets, measure burn rate, and gate releases on user impact. Use when operating a service where reliability is a feature.
---
# Error Budgets & SLOs Procedure

## Trigger / when to use
Load when operating a service with real users, deciding whether a release is safe, or arbitrating "fix bugs" vs "ship features".

## Approach
1. **Pick user-facing SLOs**: availability (99.9%), latency (p95 < 300ms), or success rate. The SLO is a promise about user experience, not an internal metric.
2. **Set the error budget**: 100% − SLO. At 99.9% availability, the budget is ~43 minutes of downtime per month. The budget is the feature velocity you can spend.
3. **Measure burn rate continuously**: how fast are you consuming the budget? A burn rate of 10x means you will exhaust the month's budget in 3 days.
4. **Gate releases on the budget**: while the budget is being spent faster than the burn-rate threshold, freeze feature work and fix reliability first. When it is healthy, ship.
5. **Alert on burn rate, not on every error**: page when the budget is on track to be exhausted, not on each incident. Noise kills reliability programs.

## Pitfalls
- SLOs that measure internals (CPU) instead of user experience.
- Treating the error budget as "how much downtime we have left to spend" rather than "how much risk we may take".
- No freeze mechanism — the budget is a dashboard, not a gate.

## Verification
Each SLO has a user-facing definition, a measured burn rate, and an alert threshold; releases are gated by a documented freeze rule; the budget review is a recurring meeting with owners.
Check each SLO dashboard for a live burn-rate graph and a documented freeze rule before any release gate is trusted.
