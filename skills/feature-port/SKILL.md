---
name: feature-port
description: Port a feature from another agent/tool into Mochi properly — study the original, extract the invariant idea, rewrite for Mochi's architecture (Rust core + TS fallback, zero runtime deps), add parity tests. Use when adapting any external design rather than cargo-culting it.
---

# Feature Port Procedure

Port the IDEA, not the code. A port that keeps the original's file layout is a transplant rejection waiting to happen.

## 1. Study the original (read before writing)
- Read the feature's actual implementation, not its README. Identify: the invariant it guarantees, the inputs/outputs, the failure modes it handles, and what it does that OUR codebase makes unnecessary.
- Write a 5-line spec: "Feature X guarantees Y under Z constraints. Triggers: A, B. Outputs: C."
- List what Mochi already has that covers half of it — a port that's 80% existing code is a composition, not a port.

## 2. Rewrite for Mochi's architecture
- Zero runtime deps: reimplement with stdlib. A port that adds a dependency is rejected on principle.
- Rust core + TS fallback: if the feature is hot-path or pure, the invariant logic goes in the Rust core with a TS fallback that must pass differential parity tests (same inputs -> same outputs, adversarial cases included).
- Name things Mochi's way (src/<domain>/<feature>.ts + .test.ts), wire into the CLI/TUI the way sibling features are, and honor config/safety systems (permissions, approval gates) — a feature that bypasses the permission model is a security hole, not a port.

## 3. Tests are the port contract
- Parity test: for pure logic, differential Rust-vs-TS on real + adversarial inputs.
- Behavior test: the original's documented behavior becomes a test case verbatim.
- Failure test: each failure mode from step 1 gets a case. A port without its failure modes is a fair-weather feature.

## 4. Document the lineage
- Skill/README note: what was ported, from where, and what was CHANGED for Mochi (and why). Users comparing agents need to see the delta, not just the clone.

## Pitfalls
- Porting the API shape along with the idea (snake_case getters, callback pyramids) — adapt to the host's idiom.
- Porting the bugs: read the original's issue tracker for the top 3 open bugs; do not re-import them.
- Porting a feature whose problem Mochi doesn't have (e.g. bringing a slow-start index to a zero-dep agent) — the port test is "does this make Mochi better," not "does this make Mochi more like X."
