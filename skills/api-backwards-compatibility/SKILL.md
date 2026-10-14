---
name: api-backwards-compatibility
description: Change APIs without breaking existing clients — deprecation windows, additive changes, and safe removal. Use when evolving a library, CLI, or HTTP API others depend on.
---
# API Backwards Compatibility Procedure

## Trigger / when to use
Load before changing any public API (function signature, CLI flag, endpoint, config key) that external callers or other teams depend on.

## Approach
1. **Make the change additive if possible**: a new optional field, a new endpoint, a new flag with a default — additive changes break no one. Prefer this over a breaking change almost every time.
2. **If it must break, support both for a window**: accept the old and the new shape, translate at the boundary, and emit a dated deprecation warning naming the removal version.
3. **Never change behavior silently**: tightening validation, changing a default, or reordering output is a breaking change even if the signature is identical.
4. **Remove on a schedule, loudly**: deprecated → warn → remove, across at least one major version or one quarter. Silent removal is the change that erodes trust.
5. **Version the contract**: a schema version, a changelog entry, and a migration note. Consumers must be able to discover the change without reading your commits.

## Pitfalls
- Assuming "nobody uses it" because your repo has no internal callers — external users are invisible.
- Breaking the response while adding to the request (or vice versa) — breaking is breaking.
- Renaming for aesthetics on a stable API — the cost lands entirely on callers.

## Verification
Contract tests assert the old shape still works during the deprecation window; the deprecation warning names the replacement and removal version; the removal lands only after the documented window and a major bump.
