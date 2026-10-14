---
name: root-cause-analysis
description: Find the actual cause instead of the first plausible one — evidence-first diagnosis, bisection, hypothesis elimination, and distinguishing symptom from cause. Use when debugging anything non-trivial.
---
# Root Cause Analysis Procedure

## Trigger / when to use
Load when a bug resists a quick fix, the "obvious" explanation doesn't survive contact with evidence, or you're about to change something you don't understand.

## Approach
1. **Reproduce deterministically first**: a bug you can't reproduce on demand is a bug you'll fix by luck. Minimize the reproduction (single file, single input, shortest log) until it's trivial to trigger.
2. **Bisect the space**: git bisect for regressions, binary search over input size, and split at the boundary (which component, which layer). Each bisection halves the hypothesis space without guessing.
3. **Form falsifiable hypotheses**: "elixir counter drifts because the display reads before the tick commits" — not "elixir is weird". A hypothesis you cannot test is a mood, not a hypothesis.
4. **Eliminate with evidence, not agreement**: add a log, a breakpoint, or a test at the exact point where the hypothesis predicts behavior. When prediction and reality disagree, the cause is usually one layer earlier than you think.
5. **Fix the class, then the instance**: once the mechanism is found, ask "what makes this possible?" — the fix belongs at that level (a missing invariant, an unchecked assumption), not at the crash site.

## Pitfalls
- Fixing the symptom (a null guard where null "can't happen") and moving on — the next caller hits the same root cause.
- Confirmation bias: testing only the hypothesis you believe and stopping at the first pass.
- "It works on my machine" — the environment difference IS data; capture it (version, locale, timing).
- Five whys that terminate in "human error" — keep asking why the system allowed the error.

## Verification
Write a test that fails before your fix and passes after, and name the mechanism in the commit message ("state updated before event dispatched → subscribers saw stale count"). If you can't predict the failure in advance, you haven't found the cause yet.
