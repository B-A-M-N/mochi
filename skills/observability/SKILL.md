---
name: observability
description: Add and use observability — structured logging, metrics, tracing, and alert design that makes production debuggable. Use when instrumenting a service, debugging issues you can't reproduce locally, or fixing alert fatigue.
---

# Observability Procedure

You cannot fix what you cannot see. The test of observability: can a new engineer diagnose yesterday's 3am error spike from the tools alone?

## 1. Structured logging (the baseline)
- One line per event, JSON with stable keys: timestamp, level, service, request_id, event name, duration_ms, and event-specific fields. Never string-interpolated prose — you cannot query prose.
- Log levels disciplined: ERROR = needs action (paged or ticketed), WARN = degraded but functioning, INFO = state transitions, DEBUG = off in prod by default.
- PII redaction at the logger layer (config-driven denylist), not at call sites — one missed call site is a breach.
- Request correlation: request_id generated at the edge, propagated through every hop (HTTP header, message queue field, trace context) — the log line that can't be correlated is noise.

## 2. Metrics (the trend layer)
- The four golden signals per service: latency (p50/p95/p99), traffic (req/s), errors (rate + by class), saturation (queue depth, CPU, connection pool usage).
- Histograms not averages: p99 tells you about your worst user; the average tells you nothing actionable.
- Business metrics alongside tech metrics (orders/min, signups/min) — a deploy that halves signups while all infra graphs stay green is the metric gap that costs revenue.

## 3. Tracing (the multi-hop layer)
- Distributed traces across service boundaries (OpenTelemetry): one trace = one request's full journey with per-span timings. Sample smartly (100% of errors, 1-10% of successes).
- Span names stable and low-cardinality (route patterns, not URLs with IDs).

## 4. Alert design (the fatigue killer)
- Page ONLY on: user-impacting conditions that need action now (error rate >X for Y min, saturation trending to exhaustion). Everything else: dashboards, tickets, or nothing.
- Every alert has: a runbook link (what to check first), a threshold with a REASON, and an owner. Alerts without runbooks train humans to ignore them.
- Symptom alerts (users see errors) over cause alerts (CPU high) — cause alerts page you for things that self-heal.
- Audit quarterly: alerts that fired and needed no action get deleted or demoted.

## 5. Verify the observability (before you need it)
- Failure drill: inject an error in staging, confirm the dashboard shows it, the alert fires, the runbook step helps, and the trace follows the failed path. Untested observability is decoration.
- The "3am test": incident response can start from the dashboard alone. If it starts with "SSH in and look around", instrument the missing piece.

## Pitfalls
- Logging inside hot loops at INFO: cost explosion and signal burial. Sample or demote.
- Cardinality bombs (user IDs as metric labels): the metrics store dies, billing follows. High-cardinality belongs in traces/logs, not metrics.
- Green dashboards during an incident: your metrics measure the wrong layer — add user-facing symptoms to what you watch.
