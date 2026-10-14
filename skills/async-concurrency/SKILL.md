---
name: async-concurrency
description: Design correct async and concurrent code — bounded parallelism, backpressure, cancellation, and deadlock avoidance. Use when writing worker pools, streaming pipelines, or anything with await/Promise.all/spawn.
---
# Async & Concurrency Procedure

## Trigger / when to use
Load when writing worker pools, processing streams, using Promise.all/SettleAll, spawning subprocesses or threads, or debugging hangs, unbounded memory growth, or unhandled rejections.

## Approach
1. **Bound every fan-out**: `Promise.all(items.map(work))` over 10k items launches 10k concurrent operations — memory and rate limits explode. Use a pool with a fixed concurrency (p-limit, worker pool, semaphore).
2. **Choose all-vs-settle deliberately**: `Promise.all` rejects on first failure and leaks the rest (unhandled rejections); `Promise.allSettled` waits for everything. For independent work where partial success matters, settle; for transactions, all.
3. **Always propagate cancellation**: a long chain without an AbortSignal check keeps running after the caller is gone — the process hangs at exit with work nobody reads. Thread the signal through every await.
4. **Backpressure, not buffering**: if a producer outruns the consumer, queue capacity must be bounded; drop-to-dead-letter is a decision you make explicitly, never an OOM you discover.
5. **Never hold a lock across await** (JS) or block inside async (Python/Go): it destroys parallelism and invites deadlock. Do the async work, then take the lock for the state update.

## Pitfalls
- Floating promises (`void asyncFn()` with no error handler) — failures vanish silently.
- Assuming one await is atomic — between your check and your write, another task mutates the state (read-modify-write races).
- Unbounded queues "temporarily" — they become the OOM when the consumer stalls.
- Mixing callbacks and async control flow — pick one boundary and adapt (util.promisify, asyncio.to_thread).

## Verification
Write a test that runs the pool at 2x expected concurrency with a slow/dying task, then asserts: bounded peak in-flight, no unhandled rejection, prompt cancellation on signal, and correct results for the survivors.
