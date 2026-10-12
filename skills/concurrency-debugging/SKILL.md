---
name: concurrency-debugging
description: Debug races, deadlocks, and async bugs — happens-before reasoning, deterministic reproduction, and the standard race patterns in JS/Python/Rust/Go. Use when intermittent failures appear only under load, async code behaves nondeterministically, or locks/timeouts misbehave.
---

# Concurrency Debugging Procedure

Nondeterministic bugs yield to determinism. The workflow: reproduce on demand, shrink to a minimal interleaving, prove the ordering violation, then enforce it away.

## 1. Reproduce on demand (kill the "intermittent")
- Amplify the race: more threads/iterations/smaller yields. Stress harness: same operation x1000 in parallel; a race you can't trigger in 30s of hammering isn't understood yet.
- Slow down the suspect window: inject sleep/delay at the boundary where the interleaving breaks — a reproducible slow-motion version beats a fast flaky one.
- Tools: ThreadSanitizer (`-fsanitize=thread`), Go `-race`, Java `jcstress`, JS `--stress-async-dispose` / controlled microtask ordering, LOOM-style model checking for JVM.

## 2. The standard suspects (check these first — they cover most races)
- Check-then-act across an await: `if (exists(x)) { await fetch(); use(x) }` — x changed during the await. Every `await` is a yield point; every yield is an interleaving.
- Read-modify-write without atomicity: `counter++` (3 machine ops), `map.set(k, map.get(k)+1)`. Fix: atomic ops or single-threaded ownership.
- Double-checked locking broken by reordering; init-once flags written before the resource is actually ready.
- Fire-and-forget promises/tasks whose exceptions vanish and whose completion nobody awaits — the operation is racing shutdown.
- Unawaited async in constructors/destructors, and event listeners registered after the event already fired.

## 3. Happens-before reasoning
- For each shared variable: list every read/write, and for each read, which write it must follow. No synchronizes-with edge between them = a data race (formally, not intuitively).
- Language memory models matter: in JS, only one thread executes JS, but microtasks/macrotasks interleave — the "race" is state mutated between awaits. In Rust/Go/C++, true data races — `AtomicX`/channels/mutexes with correct scopes.
- Deadlock: draw the lock-order graph; a cycle is the bug. Fix by global lock ORDERING or a single lock. Livelock/timeout storms: retries without jitter synchronize the herd.

## 4. Fix classes (in preference order)
- Eliminate sharing (thread-local, per-request copies, message passing) > make it atomic/immutable > lock the smallest correct section > document the invariant with an assertion that fails loudly.
- Idempotency for retry-adjacent races: if the operation can run twice safely, most TOCTOU races become harmless.
- In async code: structure as state machines (explicit states, no floating promises), and every promise `await`ed or `.catch`ed — unobserved rejections are silent race symptoms.

## 5. Verify the fix
- The stress harness that reproduced must now pass at 10x iterations. Add it to CI (or a nightly) — races that regress silently are the worst class of regression.
- Explain the bug in one sentence with the interleaving: "thread A read x after B's write but before B's commit". If you can't, you patched a symptom.

## Pitfalls
- Adding a sleep as the fix: you didn't remove the race, you made it rarer. It will return under real load.
- Locking more: coarse locks trade races for deadlocks and throughput collapse. Lock data, not code paths.
- Assuming single-threaded JS means no races: async interleavings + shared module state + multiple workers/service workers say otherwise.
