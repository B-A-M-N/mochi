---
name: monorepo-tooling
description: Manage monorepos — workspace tooling (npm/pnpm/turbo/nx/bazel), dependency graph discipline, task caching, code sharing boundaries, and CI pipelines that don't rebuild the world. Use when structuring a multi-package repo, speeding up slow CI, or deciding what deserves its own package.
---

# Monorepo Procedure

A monorepo is a dependency graph wearing a folder costume. The tooling job: know the graph, build only what changed, enforce the boundaries.

## 1. Package boundaries (the decision that ages worst)
- Extract a package when: 2+ apps import it AND it has a stable interface AND it outlives the feature that spawned it. Premature extraction = version-coordination hell; late extraction = copy-paste drift.
- Internal packages over publish-private: package-manager workspaces (`pnpm-workspace.yaml`, npm `workspaces`) first; publish to a registry only when an external consumer exists.
- Cyclic imports between packages are the entropy of monorepos: banned by tooling (dependency-cruiser / nx boundary rules), not by convention.

## 2. Toolchain selection (2026 landscape)
- JS/TS: pnpm workspaces + Turborepo for task graph/caching = the default; Nx when you need generators/plugins/enforced module boundaries; Bazel only for polyglot-at-scale with a dedicated build engineer (admit the cost or don't start).
- Rust: a single Cargo workspace with crate boundaries; Python: uv/hatch workspaces — don't emulate JS patterns badly.

## 3. The dependency graph is law
- One direction: `apps -> packages`, never sideways between apps, never upward (a package importing an app is a bug wearing a trench coat).
- Versions: workspace protocol (`workspace:*`) for internal deps — publish-time resolution, no phantom version skew. ONE version of each external dep per repo where possible (overrides/resolutions); duplicate major versions multiply your bundle and your CVE surface.
- TypeScript project references or bundler-aware transpilation (internal packages consumed as source) — publish-step tsc per package is 2019 slow.

## 4. Task running and caching
- `turbo build --filter=...[origin/main]` mindset: every task declares inputs/outputs; cache hits skip work. A task with undeclared inputs (reads env, writes outside outputs) poisons the cache — declare or exclude.
- Remote cache for CI from day one (Vercel/Buildkite/self-hosted): the CI graph is the same as local, and warm-cache CI is the whole point.
- Pipeline order: lint/typecheck (parallel, fail fast) -> build (topological) -> test (affected only) -> e2e (affected apps). `--affected`/`--filter` on PRs; full sweep on main nightly.

## 5. CI for monorepos (the money saver)
- Changed-detection first: which packages/apps changed? Run ONLY their graphs plus dependents. `nx affected` / `turbo --filter=...[HEAD~1]`.
- Required checks per package, not per repo: a docs-only change shouldn't wait on the e2e suite. Merge queue when package count > ~10 (batch merges, re-run affected once).
- Release: changesets or per-package tags; lockstep versioning only if packages ship as a suite (decide once, write it down).

## 6. Hygiene that compounds
- CODEOWNERS per package path — review routing IS governance at scale.
- Shared configs as packages themselves (tsconfig, eslint, prettier) — one source of truth, versioned like code.
- Dependency upgrade cadence: renovate/debot weekly PRs per package group; monorepos that batch upgrades yearly upgrade nothing.

## Pitfalls
- The god package (`packages/shared` accreting everything): boundary rules + review culture keep packages cohesive, or everything becomes shared and the graph is a lie.
- Wildcard task caching (caching `test` with flaky/external inputs): a green cache that hides red reality — cache deterministic tasks only.
- Lockstep releases of independent packages: version-bump noise trains everyone to ignore changelogs.
