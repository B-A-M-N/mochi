---
name: load-testing
description: Load and stress testing with k6/Locust: realistic scenarios, ramp profiles, bottleneck reading. Use when asked for load tests, performance validation, or capacity planning.
---

# Load Testing Procedure

## 1. Test the production-shaped path
- Script the top 3 real user journeys with realistic think-time between steps, not a tight loop on one endpoint. A tight loop measures your load generator, not your app.
- Seed production-scale data first: an empty database answers everything in 5ms and proves nothing.

## 2. Ramp, don't slam
- Stages: warmup (10 VUs, 2m) → ramp (to target over 5m) → sustain (target, 10m) → spike (2x, 2m) → down. Read p95/p99 latency, error rate, and saturation (CPU, connections, queue depth) at each stage.
- k6 thresholds fail the run honestly: `http_req_failed < 1%`, `p(95) < 500`. A load test without pass criteria is a demo.

## 3. Find the actual bottleneck
- Correlate latency jumps with resource graphs: DB connections exhausted (pool errors), event-loop lag (Node), GC pauses, downstream rate limits. Fix ONE bottleneck, re-run, compare numbers.
- Load test from the same region/network as users — cross-continent latency hides in every measurement otherwise.

## 4. Keep it repeatable in CI (smoke-sized)
- Full soak runs are manual; CI gets the 2-minute smoke profile that catches 80% of regressions (N+1 queries, missing indexes, sync crypto).
- Never load-test third-party APIs at volume without permission — test behind a mock, or ask first.

## Pitfalls
- Averages lie: report p95/p99/max, never mean latency. One 30s outlier in a 50ms average is a user-facing outage.
- Autoscaling during the test measures the scaler, not capacity — disable it or note the scale events in the results.
