---
name: contract-testing
description: Lock down the boundary between two teams or systems with shared, machine-checked contracts so neither breaks the other. Use for service boundaries and published APIs.
---
# Contract Testing Procedure

## Trigger / when to use
Load when two sides (or versions) must agree on a shape, and breaking changes must be detected without full end-to-end suites.

## Approach
1. **Write the contract as the agreement**: request shape, status codes, error codes, response shape, and the meanings that do not change.
2. **Provide it once, import everywhere**: a single schema package or OpenAPI document; consumers and producers both validate against it.
3. **Test producers against consumers' expectations** (consumer-driven contracts) and vice versa; wire it into both CI pipelines.
4. **Version the contract, not free-form**: breaking changes bump a major version; additive changes are safe.
5. **Assert at the boundary**: reject malformed input immediately with a typed error rather than letting it propagate.

## Pitfalls
- A contract that defines the shape but not the semantics - teams agree on field names while disagreeing on what a value means.
- Contracts that drift because nobody runs them in CI.
- Treating contract tests as a replacement for one end-to-end happy path.

## Verification
A breaking change in either side's build fails the other side's CI before publication, with a message naming the contract clause violated.
