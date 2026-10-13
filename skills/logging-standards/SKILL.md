---
name: logging-standards
description: Structured logging that actually helps at 3am: levels, context fields, sampling, PII rules. Use when asked for logging, observability instrumentation, or log cleanup.
---

# Logging Standards Procedure

## 1. JSON lines with stable fields
- Every line: `ts`, `level`, `service`, `msg`, plus request context (`req_id`, `user_id`, `trace_id`). Grep-able text logs don't aggregate; schema-less JSON doesn't either — pick the schema once.
- Log at boundaries (request in/out, job start/end, external call result), not inside loops. A hot loop that logs per iteration is a disk DoS.

## 2. Levels with teeth
- `error`: needs a human, pages. `warn`: degraded but self-healed, reviewed daily. `info`: business-significant events only. `debug`: dev-only, off in prod.
- If error logs don't page anyone, they're warn logs. If a warn fires 10k times a day with no action, delete it or fix the cause.

## 3. Context over strings
- `log.info("payment failed", { order_id, amount, reason })` beats `"payment failed for order 123 ($45): card declined"`. Fields query; sentences don't.
- Propagate `req_id` through every layer (middleware → service → DB query comment) so one id reconstructs the whole request.

## 4. PII and volume discipline
- Never log tokens, passwords, full card numbers, raw API keys — redact at the logger (`[REDACTED]`), not by hoping callers remember.
- High-volume debug/trace sampling (1:1000) in prod; errors and warns always 100%. Set retention by level (debug 3d, info 30d, error 1y).

## Pitfalls
- Logging the request body wholesale captures passwords eventually — allowlist fields, never dump bodies.
- Timestamps in local time break cross-service correlation — UTC ISO-8601 everywhere.
