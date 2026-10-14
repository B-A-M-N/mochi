---
name: resilience-patterns
description: Make systems survive dependency failures — timeouts, retries with backoff, circuit breakers, bulkheads, and graceful degradation. Use when integrating flaky or external services.
---
# Resilience Patterns Procedure

## Trigger / when to use
Load when integrating an external API, adding retries, or when one slow dependency takes down everything downstream.

## Approach
1. **Timeouts on every external call**: no request without a deadline. A hung dependency without a timeout converts its failure into yours — the whole system stalls, not one feature.
2. **Retry only transient failures, with backoff and jitter**: 5xx, 429 (honor Retry-After), and network errors get retried; 4xx (invalid input, bad key) fail immediately. Exponential backoff with jitter avoids synchronized stampedes.
3. **Circuit-break the chronic failure**: when a dependency fails consistently, stop calling it for a cooldown and fail fast — this protects the caller's resources and gives the dependency room to recover.
4. **Bulkhead the resources**: separate pools (connections, threads, budgets) per dependency so one slow service can't consume everything and starve healthy ones.
5. **Degrade deliberately**: define what the system does without the dependency (cached data, reduced functionality, queued work) — graceful degradation is a designed behavior, not an accident.

## Pitfalls
- Retrying non-idempotent operations — retries create duplicates; make the operation idempotent (request keys) or don't retry.
- Retry storms amplifying the outage — always backoff, always jitter, always cap total attempts and total time.
- Circuit breakers that never half-open — the system stays degraded after the dependency recovers.
- Timeouts so aggressive that healthy-but-slow calls fail under load.

## Verification
Fault-inject each failure mode (timeout, 500, 429, connection reset) against a stub and assert: bounded retries with increasing delays, fast-fail when the breaker opens, and the documented degraded behavior. Verify no unbounded resource growth during the outage window.
