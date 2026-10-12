---
name: api-integration
description: Integrate third-party APIs correctly — auth patterns, retry/backoff, pagination, rate limits, idempotency, and contract testing. Use when wiring an external API/SDK into an app, debugging flaky API calls, or designing an integration layer.
---

# API Integration Procedure

Every external API will fail you: rate limits, outages, schema drift, auth expiry. The integration layer is built for those failures from day one.

## 1. Auth (do it first, do it right)
- Credentials from env/secret store, never in code or client bundles. Scoped tokens beat god tokens; rotate on a schedule with overlap (new key live before old key dies).
- OAuth: refresh token rotation handled in ONE place (the client); clock-skew tolerance on JWT validation (±60s); never log tokens (redact in the logger config BEFORE the first debug session).

## 2. Transport discipline
- Timeouts ALWAYS: connect + total, tuned to the API's real p99 (default 10s total). A missing timeout turns their outage into your outage.
- Retries: idempotent requests only (GET/PUT/DELETE; POST only with an idempotency key), exponential backoff + full jitter, max 3-4 attempts, honor `Retry-After` on 429.
- Circuit breaker: after N consecutive failures, fail fast for a cooldown. Without it, your thread pool is their outage's first casualty.

## 3. Pagination and consistency
- Cursor pagination preferred; treat cursors as opaque. Handle the mid-pagination-write race (item appears twice) with dedupe by ID.
- Consistency snapshots: for list+fetch patterns, capture IDs first, then fetch details — don't paginate a moving set.

## 4. Contracts
- Parse defensively: unknown fields ignored, types validated at the boundary (zod/pydantic/valibot) — API schema drift becomes a clear validation error, not a mystery undefined three layers deep.
- Contract tests against a recorded fixture (updated on API version bumps); a weekly canary call in CI for critical vendors.
- Pin the API version header; upgrade deliberately with a changelog read, never silently.

## 5. Observability (before first production call)
- Log: method, endpoint, status, latency, attempt number, request ID from their response headers. Never the payload (PII/credentials).
- Metrics: per-endpoint error rate and latency. The dashboard that tells you the vendor degraded BEFORE your users do.

## 6. Failure-mode table (write it down)
- For each endpoint: what happens on timeout / 429 / 5xx / auth failure / partial response. Degraded mode > hard failure where possible (cached data, feature disabled with a banner).

## Pitfalls
- Retrying POSTs without idempotency keys: the classic double-charge. If the vendor supports the key header, use it on every write.
- SDK-first thinking: thin SDKs age badly; a 50-line typed client you own beats a 5MB generated one you can't fix — unless the API is huge or auth is complex.
- Trusting their sandbox as production-parity: rate limits, latency, and data volume differ by 100x. Load-test your integration's backpressure separately.
