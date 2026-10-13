---
name: zero-downtime-deploys
description: Zero-downtime deployments: rolling updates, health gates, migrations, instant rollback. Use when asked for safe deploys, rollout strategy, or release automation.
---

# Zero-Downtime Deploy Procedure

## 1. Rolling updates behind health gates
- Never all-at-once: roll N% (canary 5% → 25% → 50% → 100%), each stage gated on health checks + error-rate SLOs for 10+ minutes. A deploy that can't pause mid-roll isn't safe.
- Readiness probes must reflect REAL readiness (DB connected, migrations applied, warm caches) — a probe that returns 200 on boot lies during the exact window that matters.

## 2. Migrations before code, backwards compatible always
- Expand then contract: migration adds nullable columns/tables first (deploy 1), code uses them (deploy 2), old columns drop (deploy 3). A code+drop in one deploy breaks running old instances mid-roll.
- Every migration needs a tested DOWN path or a forward-fix plan — "we'll fix forward" without the fix written is a hope, not a plan.

## 3. Instant rollback, practiced
- Rollback is one command (previous image tag / traffic flip) executable in under 5 minutes by the on-call engineer alone. If rollback needs a build, it isn't a rollback.
- Keep the last N artifacts immutable; `latest` tags make rollback target ambiguous. Game-day the rollback quarterly or it rots.

## 4. Verify the rollout, then declare done
- Watch golden signals (latency p99, error rate, saturation) through the full roll, not just green health checks. Compare against pre-deploy baseline, not absolute thresholds.
- Feature flags for behavior changes inside the deploy: ship dark, enable for 1% via flag, ramp — deploy risk and release risk stay separate.

## Pitfalls
- Long-lived connections (websockets, gRPC streams) don't drain on SIGTERM unless you handle it — connection draining with a deadline is mandatory.
- In-flight requests during pod termination need grace periods (terminationGracePeriod + preStop sleep) or users see 502s at every deploy.
