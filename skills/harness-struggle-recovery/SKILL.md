---
name: harness-struggle-recovery
description: Agent stall/struggle detection and recovery — struggle-state injection, escalation ladder, provider failover. Use when touching the loop, Chameleon, or autonomy settings.
---

# Harness Struggle Recovery

Mochi detects when the loop is stuck (repeated identical output, zero file mutations, failed tool calls) and recovers instead of spinning. This is a core differentiator — changes here need tests.

## Trigger
- Touching the agent loop, struggle detection, or Chameleon engine.
- Autonomy/mode changes that affect stall behavior.
- A hang or loop report from a long-running goal.

## Steps
1. Detection signals: consecutive identical outputs, zero mutations per N iterations, repeated tool errors with the same signature. Each signal is independent — a stall needs corroboration, not one noisy metric.
2. Escalation ladder: (a) struggle-state injection — add a system message naming the stall and forcing a strategy change; (b) mode shift (e.g. more planning, fewer edits); (c) provider/model failover; (d) give up with an honest report of what was tried.
3. Every escalation step must be visible in the run trace with its reason.
4. The loop must never silently restart an escalation level — bounded attempts, then the next rung.
5. Keep thresholds configurable via autonomy settings, with safe defaults.

## Pitfalls
- Struggle injection that just repeats "try harder" wastes tokens and doesn't change behavior — the message must mandate a concrete strategy switch.
- Failover to a different provider mid-goal: re-map tool schemas before sending, or the request fails and you've burned the context.
- Don't count normal long tool calls (tests, builds) as stalls — exempt long-running tools from the mutation-rate signal.
- Termination is a feature: an honest "I'm stuck, here's the state" beats an hour of spinning.

## Verification
- `npx vitest run src/cognitive/ src/loop*` (or equivalent) green.
- Simulated stall test: force identical outputs, assert escalation ladder fires in order and terminates.
