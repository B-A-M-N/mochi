# Mochi repo tech map — where everything lives

> One page so nobody has to guess. Generated structure, hand-written notes.
> Anything not listed here probably shouldn't be in the repo — ask before adding top-level paths.

## Runtime (shipped in the npm tarball)

| Path | What |
|---|---|
| `src/` | TypeScript frontend: agent loop, tools, TUI, providers, daemon, SDK. Tests live next to sources (`*.test.ts`). |
| `native/` | Rust core (`mochi_core/`) + C++/Rust accelerators. Built artifacts go to `native/bin/` (gitignored). |
| `dist/` | Compiled output (`tsc`) + `mochi-bin` (bun bundle). Gitignored, rebuilt via `npm run build` / `build:bin`. |
| `scripts/` | Build/test/dev scripts (`browser-driver.mjs`, `check-skips.mjs`, `sync-version.mjs`, …). |
| `README.md`, `LICENSE` | Package front page + MIT license (both shipped in the tarball). |

## Product surfaces

| Path | What |
|---|---|
| `site/` | React marketing/app source (vite). Active frontend work lives here. |
| `docs/` | Published static site (built output + hand docs: `CLI_REFERENCE.md`, `BENCHMARKS.md`, `CAPABILITIES.md`). `docs/assets/` holds built bundles — do not hand-edit hashed files. |
| `skills/` | 70+ bundled Agent Skills, one dir per skill (`SKILL.md` + assets). `skills.json` index is generated (gitignored). Share via `mochi skills pack/unpack`. |
| `examples/` | Minimal usage examples (`agents/`, `memory/`). |
| `bench/` | Benchmarks (startup, efficiency, memory, speculation, arena). `bench/arena-results.json` is gitignored (non-deterministic). |
| `dogfood/` | Scratch fixtures for live model runs (gitignored contents). Not shipped. |

## Agent-operating files (repo root)

| Path | What | Status |
|---|---|---|
| `MASTER_PROMPT.md` | Active dogfooding contract (Operation Frontier): verification laws every agent iteration follows. | **Live — read before coding here.** |
| `MASTER-PROMPT.md` | Oct-4 audit brief (the "beat every harness" task). Work is done; kept as history. Referenced in code comments as `MASTER-PROMPT Phase X`. | Historical. |
| `ARCHITECTURE.md` | Auto-generated module/symbol graph. Regenerate with `mochi docgen --write`, never hand-edit. | Generated. |
| `CHANGELOG.md` | Release notes, newest first. Add entries under `Unreleased`. | Live. |
| `MOCHI.md` | Project behavioral contract the agent reads at runtime. | Live. |
| `COORDINATION.md`, `.coordination/` | Sep-14 multi-session sprint plan. Sessions long done, nothing references it. | **Removed** (in git history if needed). |
| `ok.txt` | Leftover trivial dogfood artifact ("Create ok.txt containing ok"). | **Removed** (was tracked junk). |
| `bin/mochi` | Legacy node launcher with V8 compile-cache (~16% faster cold start). Published bin is `dist/cli.js`; global `mochi` is `dist/mochi-bin`. Kept for its startup win, not wired as default. | Legacy, documented. |

## Ignored on purpose (`.gitignore`)

`node_modules`, `dist/`, `.mochi/` (runtime state), `dogfood/` contents,
`native/bin`, `native/mochi_core/target`, `skills/skills.json`, `*.sqlite`,
secrets (`*.env`, `*.p12`, `*.pem`, `*.key`, `*token*`, `*secret*`),
`coverage/`, `bench/arena-results.json`. `lib/` holds only npm-link staging
(self-symlink, Aug) and is ignored via the `node_modules` pattern.

## Audit trail

`.mochi-audit/` — competitor matrix, speculation bench data, TUI smoke logs.
Evidence for capability claims; keep the matrix honest (every "ahead" row
must cite mechanism in code).
