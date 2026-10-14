---
name: api-versioning
description: Evolve APIs without breaking clients — additive change first, deprecation windows, compatibility shims, and migration paths. Use when changing a public API, REST contract, or library interface.
---
# API Versioning Procedure

## Trigger / when to use
Load before changing any signature, schema, or response shape that external callers (or other teams) depend on — especially published libraries and HTTP APIs.

## Approach
1. **Prefer additive**: a new optional field, a new endpoint, or a new parameter default costs nothing and breaks no one. Try to land the change additively before considering a version bump at all.
2. **Classify the breaking change**: removing/renaming a field, tightening validation, changing a type, or altering default behavior. Each demands a migration path, not just a note in the changelog.
3. **Ship parallel support**: accept both old and new shapes for a deprecation window (one quarter minimum, or one major release). Detect the old shape and normalize at the boundary.
4. **Deprecate loudly, then remove**: emit a dated warning naming the replacement and the removal version; document it. Silent removal is the breaking change that destroys trust.
5. **Version the contract, not the URL, when possible**: content negotiation or a version header avoids permanent URL forks; path versions (`/v2/`) are the fallback when clients can't set headers.

## Pitfalls
- Breaking the response while adding to the request (or vice versa) — breaking is breaking in both directions.
- Assuming "nobody uses it" from links or grep of your repo — external consumers are invisible from inside.
- Changing error semantics — a new error code on an old path is a breaking change for clients that branch on codes.
- Renaming for aesthetics on a stable API — the cost lands entirely on callers, the benefit entirely on you.

## Verification
Write contract tests that pin the OLD shape and the NEW shape both working during the window, and one that asserts the removal actually happens after it. Grep the diff for removed fields and confirm each has a shim or a documented replacement.
