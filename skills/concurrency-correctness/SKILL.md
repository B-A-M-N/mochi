---
name: concurrency-correctness
description: Write concurrent code that is actually correct — happens-before, lock discipline, and avoiding data races. Use when writing parallel, async, or threaded code.
---
# Concurrency Correctness Procedure

## Trigger / when to use
Load when writing multi-threaded, parallel, or heavily async code, or when debugging a bug that "only happens sometimes" — the classic signature of a race.

## Approach
1. **State the invariant, then protect it**: every shared value has an invariant (a counter is never negative, a map is never mutated mid-iteration). Concurrency bugs are invariant violations made visible by interleaving.
2. **Make sharing explicit**: prefer immutability and message passing over locks. If you must lock, one lock, one purpose, acquired in a fixed order — lock-ordering violations are deadlocks waiting to happen.
3. **Close the happens-before gaps**: a value written in one thread is not visible in another until a synchronization edge (join, atomic, channel, mutex). If you cannot name the edge, the read is a data race.
4. **Test with the race detector, not with sleep**: `go test -race`, `tsan`, TSAN, or stress loops with assertions. Sleeping to "let threads finish" is how races survive CI.
5. **Reduce concurrency until it is obviously correct**: the fastest concurrency is the one you removed because it was not needed.

## Pitfalls
- `sleep(100)` as a synchronization mechanism — it hides races and adds a second of flakiness.
- Atomic counter with a non-atomic check-then-act around it (TOCTOU).
- Locking inside a callback that may be re-entered — re-entrant deadlock.

## Verification
The race detector reports zero races under a stress test; every shared value has a named synchronization edge; the design review can state which invariant each lock protects.
