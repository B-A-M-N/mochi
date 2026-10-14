---
name: chaos-engineering
description: Prove a system survives failure by injecting it deliberately — game days, fault injection, and steady-state hypotheses. Use when you need evidence, not hope, that a system is resilient.
---
# Chaos Engineering Procedure

## Trigger / when to use
Load when operating a distributed system where "it probably survives a failure" is not good enough, and you need to demonstrate resilience to the business.

## Approach
1. **Start from steady state**: define what "normal" looks like (latency, error rate, throughput). You can only detect a deviation if you know the baseline.
2. **Form a hypothesis**: "If service A fails, the system degrades but serves reads." The experiment tests the hypothesis, not the chaos for its own sake.
3. **Blast the smallest radius first**: inject on one instance, one rack, one region. A chaos experiment that takes down everything is not an experiment — it is an outage you caused.
4. **Inject real failures, not simulated ones**: kill processes, add latency, fill disks, drop packets. Simulated failures miss the real failure modes (and the real bugs).
5. **Automate and run continuously**: manual game days prove nothing about the system you ship next week. Continuous, automated experiments do.

## Pitfalls
- Chaos without a hypothesis — breaking things to see what happens is not learning.
- Running in production on day one — start in staging, then canary.
- Skipping the steady-state baseline, so you cannot tell a deviation from noise.

## Verification
Every experiment states a steady-state hypothesis and a blast radius before it runs; findings are tracked as issues with owners; the suite runs automatically and its experiments are safe to execute in production.
