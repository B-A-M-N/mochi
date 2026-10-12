---
name: native-core-port
description: Port a TypeScript operation to the Rust native core end-to-end — Rust op, C ABI, napi binding, TS fallback, parity tests. Use when adding or extending native/* modules.
---

# Native Core Port Procedure

Mochi's native core lives in `native/` (Rust, compiled to a .node addon via napi-rs). Every hot operation follows the same five-layer pattern. Skip a layer and you create drift.

## Trigger
- A TypeScript hot path shows up in profiles (TTFF/TTFI/PSS probes).
- A new native module is requested in `native/src/`.
- Parity drift reported between native and TS implementations.

## Steps
1. **Rust op** (`native/src/<module>.rs`): pure function, no I/O, no global state. Input → output, all types `Serialize`/`Deserialize`-compatible with the TS shapes.
2. **C ABI** (`native/src/ffi.rs` if needed): `#[no_mangle] pub extern "C"` wrapper for anything napi can't express directly (byte buffers, callbacks).
3. **napi binding** (`native/src/lib.rs`): `#[napi]` export. Keep the signature identical to the TS function — same argument order, same optional handling.
4. **TS fallback** (`src/native/<module>.ts`): pure-TS implementation with the exact same semantics. Export both behind `native.available ? native : ts` selection in `src/native/index.ts`.
5. **Parity tests** (`src/native/<module>.parity.test.ts`): property-based differential testing — same inputs to both implementations, results must be deeply equal. Include adversarial cases: empty input, max-size input, invalid UTF-8, boundary numbers.

## Pitfalls
- Do NOT let the TS fallback drift: any behavior change must land in both, in the same commit.
- napi-rs rejects some Rust types (tuples as-is, complex enums) — flatten to plain objects/arrays at the boundary.
- `cargo build` warnings are acceptable; clippy warnings on `native/` are not (CI pins `-D warnings`).
- Never panic in Rust ops — return `Result` and surface `Err` as a thrown TS error.

## Verification
- `npm run build` (tsc clean).
- `cd native && cargo test` — Rust unit tests green.
- `npx vitest run src/native/` — parity suite green, including the adversarial cases.
- Benchmark before/after with the perf probe: the port must beat TS on the target op, else revert.
