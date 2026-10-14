---
name: microservices-patterns
description: Build distributed systems that survive partial failure — service boundaries, sagas, and inter-service communication. Use when splitting a monolith or building a system that must scale and deploy independently.
---
# Microservices Patterns Procedure

## Trigger / when to use
Load when splitting a monolith or building a system that must deploy, scale, and evolve services independently — and you are ready to pay the distributed-systems tax.

## Approach
1. **Decompose by business capability, not by layer**: each service owns its data and its API. Shared databases are the monolith in disguise.
2. **Design for failure from day one**: every call across a service boundary can fail, hang, or double-execute. Timeouts, retries with backoff and jitter, idempotency keys, and circuit breakers are not optional.
3. **Use sagas for cross-service workflows**: a distributed transaction is a saga of local transactions with compensating actions. Two-phase commit is a last resort.
4. **Prefer async messaging for coupling**: events let services evolve independently; synchronous request/response couples their availability.
5. **Make operations easy**: distributed tracing, health checks, and log correlation across services are the difference between "it is down" and "I know which service is down".

## Pitfalls
- Distributed monolith — services that must deploy together share a database.
- Sync call chains that turn one failure into a cascading outage.
- Splitting before the domain is understood — you get distributed complexity AND a bad design.

## Verification
Each service has one owner, owns its data, and can deploy alone; every cross-service call has a timeout, retry, and idempotency strategy; a single service failure does not cascade (proven by a kill test).
