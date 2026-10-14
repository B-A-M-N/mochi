---
name: idempotency-design
description: Design operations that can run more than once without changing the outcome - keys, fences, and convergence. Use for payments, queues, retries and migrations.
---
# Idempotency Design Procedure

## Trigger / when to use
Load when building anything retried, replayed, duplicated or double-submitted (payments, webhooks, queue consumers, migrations).

## Approach
1. **Name the replay window**: exactly-once-that-monitor believes runs for 24h? exactly-once per logical request key? Pick and document.
2. **Provide the client's request key**: do not invent something fragile from input data; a UUID per user action, passed and stored.
3. **Store outcome keyed by request id** so a repeat returns the original result rather than re-executing.
4. **Idempotency of side effects too**: downstream calls (email, payments, inventory) need their own keys or a transactional outbox.
5. **Make convergence explicit**: for state updates, store the action and re-apply is a no-op; avoid read-modify-write that silently races.

## Pitfalls
- Keying on timestamps (replays differ by microseconds).
- Returning success on repeat but with new side effects (charge then charge again, "silently fine").
- Expiring idempotency windows silently shorter than the retry horizon.
- Forgetting concurrency: two identical requests arriving at once - serialize at the key.

## Verification
Fire the same request many times concurrently and across a deliberate delay; total external side-effect count and final state stays 1, not N.
