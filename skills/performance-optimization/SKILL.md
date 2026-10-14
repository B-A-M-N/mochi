---
name: performance-optimization
description: Make code faster the right way — measure first, fix the hotspot, verify the win. Use when code is too slow and you need real improvement, not a guess.
---
# Performance Optimization Procedure

## Trigger / when to use
Load when a path is measurably too slow (latency, throughput, memory) and you need to make it faster without breaking correctness.

## Approach
1. **Profile before you touch anything**: a flame graph, benchmark, or timing harness tells you where the time actually goes. Optimizing the unprofiled is how you make the wrong thing 5% faster.
2. **Find the hot path, not a hot line**: the cost is usually an algorithm (O(n^2) loop) or an I/O pattern (N+1 queries), not a micro-expression. Fix the complexity class first.
3. **Fix the dominant cost once**: after the big win, re-profile. The second optimization is usually worth 10x less than the first — stop when the budget is met, not when it is perfect.
4. **Preserve correctness with a benchmark + tests**: keep the old behavior pinned by tests so the speedup cannot silently change semantics.
5. **Report the number**: "2.1s → 0.4s (5x) on the benchmark" is the only honest summary. "It is faster now" is not.

## Pitfalls
- Optimizing code that is not on the hot path (premature optimization).
- Sacrificing clarity for a win smaller than the noise.
- Micro-optimizing allocations while an O(n^2) algorithm dominates.

## Verification
A benchmark shows a measurable improvement on a representative workload; the existing test suite still passes; the optimization targets a cost the profiler confirmed was dominant.
