---
name: benchmark-methodology
description: Honest benchmarking with TTFF/TTFI/PSS probes — cold start, token throughput, prompt-to-first-token. Use when measuring performance or publishing numbers in BENCHMARKS.md.
---

# Benchmark Methodology

Published numbers must survive scrutiny. An inflated number in BENCHMARKS.md is worse than a missing one.

## Trigger
- Adding a native op, changing startup path, or touching the TUI render loop.
- Updating BENCHMARKS.md or the README badge numbers.
- Verifying a performance regression report.

## Steps
1. Define the metric precisely before measuring: TTFF (time to first frame), TTFI (time to interactive), PSS (prompt-to-stream start), cold start (process spawn → REPL ready).
2. Warm the machine: discard the first run entirely (FS cache, JIT).
3. Measure N ≥ 30 runs; report median and p95, never the minimum.
4. Fix versions: record node version, OS, CPU, and commit SHA alongside results.
5. Compare against the previous release tag, not against `main` HEAD (drift).
6. Update BENCHMARKS.md only with numbers from a clean tree on the release tag.

## Pitfalls
- Benchmarks on battery/power-saving profiles lie — pin CPU governor or note it.
- `process.hrtime.bigint()` for timing, never `Date.now()` (ms resolution insufficient).
- Don't benchmark with the debugger or coverage instrumentation attached.
- If a number gets worse, publish it anyway with the regression noted — honesty is the brand.

## Verification
- Rerun the full suite on a second machine or VM; medians within ~15%.
- BENCHMARKS.md table matches script output exactly (no hand-typed numbers).
