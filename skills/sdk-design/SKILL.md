---
name: sdk-design
description: Client library/SDK design: resource-oriented surface, pagination, errors, retries, versioning. Use when asked for an SDK, client library, or API wrapper.
---

# SDK Design Procedure

## 1. Resources with verbs, not endpoint mirrors
- Design around nouns users think in (`client.invoices.create()`, not `client.post('/v1/invoices')`). One method per user intent; the HTTP mapping is an implementation detail.
- Pagination built in: auto-iterating lists (`for await (const x of client.items.list())`) with manual page control available. Nobody should hand-roll cursors.

## 2. Errors users can program against
- Typed error classes per failure mode (`NotFound`, `RateLimited`, `AuthError`), each carrying `status`, `code`, and `retryable`. A single generic `ApiError` with a string forces string-matching.
- Retry transient failures (429, 5xx, timeouts) with backoff + jitter inside the SDK, and expose idempotency keys for safe retries of writes.

## 3. Auth and config ergonomics
- `new Client({ apiKey })` plus env-var fallback (`ENV_KEY`) plus explicit override order documented. Fail at construction with the missing-key NAME, not at first call.
- Timeouts + user-agent defaults set; region/base-URL override is one obvious parameter, not a config maze.

## 4. Versioning and docs that stay true
- Semver strictly: new methods minor, signature changes major. Generate reference docs from types (typedoc/pydoc), hand-write 3 runnable examples (auth, common op, error handling) and TEST those examples in CI.
- Changelog entries per release; deprecations warn for one full minor before removal.

## Pitfalls
- Sync AND async surfaces maintained in parallel double the bug surface — pick one primary, generate or clearly subordinate the other.
- Leaking HTTP details (raw status codes, header names) into method signatures couples users to transport trivia.
