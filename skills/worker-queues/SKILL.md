---
name: worker-queues
description: Background job queues (BullMQ/SQS/pg-boss): job design, retries with backoff, dead-lettering, observability. Use when asked for queues, background jobs, or async workers.
---

# Worker Queue Procedure

## 1. Jobs are data, not code references
- Payload must be JSON-serializable ids + params, never closures or class instances. A job that can't survive a Redis restart is broken.
- Name jobs by intent (`send-receipt`, not `process-thing`) and version them (`send-receipt.v2`) so deploys don't poison in-flight work.

## 2. Retries with exponential backoff + jitter, then dead-letter
- Transient (network, 429, 5xx): retry 3-5x, backoff `2^n` seconds + jitter. Permanent (400, validation): fail immediately to the dead-letter queue.
- Never infinite retries — a poison message that retries forever starves the queue. DLQ + alert, then a human replays after the fix.

## 3. Concurrency and rate limits
- Set worker concurrency from the downstream bottleneck (DB pool size, API rate limit), not CPU count. A 50-concurrency worker against a 10-connection pool just queues timeouts.
- Long jobs send heartbeats/extend visibility timeouts (SQS) or use stalled-job detection (BullMQ) so a slow job isn't double-executed.

## 4. Observability is the feature
- Every job logs start/end/duration + outcome; dashboard shows queue depth, failure rate, oldest waiting job. Alert on depth growth, not just failures.
- Test the failure paths: kill the worker mid-job (at-least-once must re-run cleanly), poison payload (must DLQ, not loop).

## Pitfalls
- Processing the same job twice must be safe (idempotency keys on side effects) — exactly-once delivery doesn't exist.
- Cron-shaped work belongs in a scheduler, not a queue consumer polling on an interval.
