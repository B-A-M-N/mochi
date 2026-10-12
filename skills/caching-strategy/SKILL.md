---
name: caching-strategy
description: Design caching layers — HTTP caching, CDN, application memory caches, invalidation patterns, and cache-coherence reasoning. Use when adding caching to fix performance, debugging stale-data bugs, or designing cache keys/TTLs.
---

# Caching Strategy Procedure

There are only two hard problems in computer science, and this skill is about both of them. The discipline: know what invalidates your data, encode it in keys/TTLs, and measure the hit rate.

## 1. Classify the data before caching it
- Immutable/append-only (compiled assets, historical records): cache forever (immutable + content-hash keys). This is the free win.
- Read-heavy, tolerate staleness (catalogs, profiles, config): TTL 30s-15min + explicit purge on write.
- Must-be-fresh (balances, inventory, permissions): don't cache, or cache with write-through invalidation and short TTL — and measure whether the cache actually helps before keeping it.

## 2. Key design (the #1 cache bug source)
- Keys include EVERYTHING that changes the response: identity, params, locale, tenant, feature flags. A missing key dimension = data leaks across users (the classic authz bug).
- Key normalization: sort params, strip defaults, canonicalize case. Key collisions are silent correctness bugs.
- Vary-with-care: `Vary` header / cache scopes must match the actual request variability, not a superset (kills hit rate) or subset (kills correctness).

## 3. Layer-by-layer defaults
- HTTP: static assets -> `Cache-Control: public, max-age=31536000, immutable` + hashed filenames. HTML/API -> `no-store` for personalized, `max-age=0, must-revalidate` + ETag for shared. Never `Expires` alone.
- CDN: respect origin headers; purge API for deploy-triggered invalidation; stale-while-revalidate for latency-critical pages (stale content beats error pages).
- Application memory (LRU per process): only for hot small objects (config, feature flags); bounded size MANDATORY (unbounded maps are the leak); TTL short (the coherence radius is one process).
- Shared store (Redis/Memcached): for cross-process state; watch for hot keys (single key = single shard = your bottleneck; shard by suffix or use local + pub-sub refresh).

## 4. Invalidation patterns
- Event-driven purge beats TTL-guessing: on write, publish an invalidation event (or use versioned keys — bump the version, old entries age out).
- Versioned keys are the general solution: `user:{id}:profile:v{profileVersion}` — writes bump the version, invalidation becomes O(1), stale reads impossible.
- Stampede protection: single-flight (per-key in-process mutex) or probabilistic early expiry (`XLA`-style). A thundering herd after TTL expiry is a self-inflicted DDoS.

## 5. Measure or delete
- Hit rate per key class, p50/p99 with and without cache, backend load reduction. A cache with <20% hit rate on a cheap backend is pure liability.
- Stale-bug triage: trace the data's write path — which layer still holds the old value? (browser, CDN, app LRU, Redis, DB replica). Each layer needs its own invalidation story; "cleared the cache" that skipped a layer recreates the bug in hours.

## Pitfalls
- Caching errors/negative results without a short TTL: an outage response cached for 15 minutes extends the outage by 15 minutes.
- Cache-aside with write-through-to-DB on read path: the classic race (read miss -> stale write-back). Prefer versioned keys.
- Personalized data cached at a shared layer without identity in the key: an immediate security incident, not a perf bug.
