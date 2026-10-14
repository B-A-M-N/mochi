---
name: tradeoff-analysis
description: Make engineering decisions explicitly — enumerate options, evaluate against constraints, and document the tradeoff chosen. Use when choosing between architectures, libraries, or designs.
---
# Tradeoff Analysis Procedure

## Trigger / when to use
Load when facing a choice where more than one option is defensible, when a design review keeps going in circles, or when you need to justify a decision in writing.

## Approach
1. **State the constraints first**: what MUST hold (correctness, deadline, existing contracts) vs what you're optimizing for (latency, cost, team familiarity). Constraints eliminate options before opinions form.
2. **Enumerate at least three options** including "do nothing" and the cheapest possible thing. Two-option comparisons are usually a framing failure.
3. **Score against the stated goals, not vibes**: build a small matrix (option × constraint) with one-line cells. Force yourself to write why each cell is good or bad.
4. **Name what each option makes worse**: every choice trades something; the decision is which cost you can carry. "No downsides" means you haven't looked.
5. **Record the decision with its context**: an ADR-style note (what, why, what we rejected, when to revisit). Decisions without recorded context get re-litigated every six months.

## Pitfalls
- Analysis paralysis — pick by the constraint that's hardest to reverse.
- Sunk cost ("we've built half of it") — that's not a constraint, that's history.
- Optimizing the metric that's easy to measure instead of the one that matters.
- Choosing the familiar option without pricing the unfamiliar one.

## Verification
Write the ADR before implementing and check: options enumerated (≥3), each rejected option has a one-line reason, and the chosen cost is named explicitly. If you can't fill the rejected-reasons column, you don't understand the options yet.
