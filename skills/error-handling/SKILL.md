---
name: error-handling
description: Design deliberate error handling — typed errors, boundary translation, retry vs fail-fast, and never swallowing failures. Use when adding try/catch, designing APIs, or debugging silent failures.
---
# Error Handling Procedure

## Trigger / when to use
Load when writing or reviewing try/catch blocks, designing a public API's failure surface, deciding retry policy, or hunting a bug where "nothing happened" with no error.

## Approach
1. **Name the failure class first**: programmer error (bug — let it crash), operational error (timeout, 429, disk full — the caller can act), or user error (invalid input — validate at the boundary). The class decides the policy; never apply one blanket catch.
2. **Translate at boundaries, not in the middle**: inner code throws domain-typed errors (`RateLimited`, `ConfigMissing`); the outer layer (HTTP handler, CLI command) converts them to transport shapes (status code, exit code). Catch-and-rewrite at one layer only.
3. **Fail fast for programmer errors, recover for operational ones**: a null where it can't be null is a bug — throw with the value in the message. A 429 is expected — retry with backoff and jitter, capped.
4. **Never swallow**: an empty catch, `catch { return null }`, or logging-and-continuing turns a diagnosable crash into a silent wrong answer — the worst outcome. If you truly must continue, log with context and a distinct marker.
5. **Preserve the cause**: `throw new Err('failed to fetch user', { cause: e })` in JS, `raise ... from e` in Python. A chain without a cause doubles the debugging time.

## Pitfalls
- Catch-all `catch (e)` in library code — it hides which failures callers can handle.
- Retrying non-idempotent operations (POST that creates) — retries create duplicates; make the op idempotent or don't retry.
- Wrapping the same error at every layer — the message becomes 5 lines of "failed while doing X" and the root is last.
- Catching errors you cannot handle just to keep the process alive — a half-alive process produces wrong results confidently.

## Verification
Grep your diff for `catch` blocks lacking either a rethrow, a typed conversion, or a log with context. Then prove one failure path end-to-end (fault injection or a stubbed failure) and confirm the caller sees the right class — not a swallowed null.
