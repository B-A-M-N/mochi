---
name: api-design
description: Design public APIs and CLIs — naming, ergonomics, versioning, error surfaces, and backward-compat discipline. Use when adding a public command, SDK surface, REST/JSON contract, or plugin interface. Ported from Anthropic/OpenAI API-design practice.
---

# API Design Procedure

APIs are promises. Design for the version that ships in 2 years, not the demo next week.

## 1. Shape from the consumer's side first
- Write the ideal consumer code BEFORE the implementation. If the call site reads awkwardly, redesign — the call site is the product.
- Consistency with the sibling surface: a new CLI command follows the existing command grammar (`mochi <noun> <verb> --flag`), a new REST route follows the existing resource grammar. Surprise = defect.

## 2. Naming discipline
- Nouns for resources, verbs for operations, plain English throughout. One concept = one word everywhere (`session`, never session/job/instance mixed).
- Avoid abbreviations except universal ones (id, url). Avoid negated flags (`--no-cache` beats `--cache=false` which beats `--disable-caching`).
- Reserved for the future: every list response gets `nextCursor` from day one, every object carries `id` and timestamps, even if unused.

## 3. Error surface
- Errors are data: stable machine-readable code + human message + actionable hint. Never a bare string, never a stack trace.
- 4xx = caller's problem (fixable by changing the request), 5xx = callee's problem (retryable or reportable). Timeouts are 5xx-shaped.
- Every failure mode a consumer can hit is documented with an example response.

## 4. Versioning and compat
- Additive changes only within a version: new optional fields, new endpoints. Removing/renaming = new major version, period.
- Never repurpose an existing field's semantics — consumers have already built on it. Deprecate with a timeline: announce, warn in responses (`Sunset` header / CLI warning), then remove in the next major.
- Unknown fields: consumers (and our parsers) must ignore unknown fields — forward compatibility is a two-way contract.

## 5. Ergonomics pass
- Sensible defaults so the hello-world is one call. Required params: as few as possible, ordered by importance.
- Idempotency on mutating operations (idempotency keys or natural keys) — retries are normal in production networks.
- Dry-run/plan mode where an operation is expensive or destructive.

## 6. Verification
- Contract tests capture the public surface (snapshot of routes/flags/errors) so breakage fails CI loudly.
- A consumer walkthrough: integrate the API fresh, using only the docs. Every stumble is a doc bug or a design bug — log which.

## Pitfalls
- Leaking internals into the public shape (`error: "ECONNRESET at /src/..."`) — translate at the boundary.
- Boolean traps (`process(x, true)`), out-parameters, and 7-arg functions: wrap in an options object past 3 params.
- Shipping v1 without the escape hatch (pagination, filters): retrofitting lists is a breaking change by default.
