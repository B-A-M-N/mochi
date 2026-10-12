---
name: performance-profiling
description: Measure, locate, and fix performance problems in any program — flame-graph workflow, allocation tracing, latency budgets, and benchmark discipline. Use when something is slow, memory grows, or a benchmark regressed. Ported from Codex/production-engineering practice, rewritten for Mochi.
---

# Performance Profiling Procedure

Never optimize without a measurement. The workflow is: measure -> locate -> fix ONE thing -> re-measure.

## 1. Establish the baseline (before touching code)
- Define the metric precisely: p50/p99 latency? RSS? throughput/s? Cold or warm? A benchmark without a workload definition is fiction.
- Freeze the workload: fixed input, fixed iterations, fixed environment. Save the input so the re-measure is identical.
- Run the baseline 5 times, take the median, record the spread. If the spread is >20% of the value, fix the environment noise first (CPU governor, other processes, thermal throttle).

## 2. Locate (hierarchy of tools)
- CPU: wall-clock first (which PHASE is slow), then sampling profiler (which FUNCTION), then line-level only if the function is still a mystery. `perf record -g` / `0x` / py-spy / `node --cpu-prof`.
- Memory: RSS over time for leaks (grows and never returns = leak); heap snapshots diffed between T0 and T1 for retention paths; allocation profiling for churn.
- I/O: `strace -c` / `iostat` — is it syscalls, page cache misses, or the network? N+1 query patterns show as many small round-trips.
- Startup: the slowest imports/inits first — `node --cpu-prof` on boot, lazy-load anything not needed for first interaction.

## 3. The usual suspects (check these before deep profiling)
- N+1 queries (DB or filesystem), O(n^2) in a hot loop, JSON.parse/stringify on large objects in a per-request path, synchronous I/O on an event loop, unbounded caches (memory + GC pressure), regex backtracking on user input.
- Allocations in loops: string concat, array spread, closures per item. Hoist them.
- In JS: double-await chains, missing Promise.all on independent awaits, and synchronous crypto/zlib.

## 4. Fix one thing, re-measure
- The smallest change that moves the metric. Re-run the SAME benchmark. Keep if it wins, revert if not — "should be faster" is not a measurement.
- Guard the win: add the benchmark to CI (or a regression threshold) so it stays won.

## 5. Report
- Before/after numbers with the workload spec, the profiler evidence (flame graph or trace excerpt), and the diff. No measurement = no claim.

## Pitfalls
- Micro-optimizing code that runs once. Profile finds the 3% that runs 90% of the time; everything else is noise.
- Benchmarking in debug/interpreted mode and shipping the conclusion to prod builds (JIT, `-O2`, LTO change winners entirely).
- Fixing memory by adding GC pressure (copies), or fixing CPU by caching unbounded (trading CPU for a leak).
