---
name: ci-pipeline-design
description: Design and repair CI/CD pipelines — fast feedback stages, parallelization, flaky test quarantine, artifact flows, and deploy gates. Use when builds are slow, CI is flaky, deploys are scary, or setting up a new project's pipeline.
---

# CI Pipeline Design Procedure

CI is the team's shared nervous system. The design goal: every push gets a trustworthy verdict in under 10 minutes, and main is always releasable.

## 1. Stage topology (fast feedback first)
- Stage 1 (<=2 min, on every push): lint + typecheck + unit tests — catches 80% of breakage for 10% of the cost. Fail here before anything expensive runs.
- Stage 2 (parallel where independent): build + integration tests, affected-only for monorepos. Stage 3: e2e/deploy gates on main/PR-ready only.
- Total pipeline = the SLOWEST required path. Optimize the critical path (usually e2e), not total CPU.

## 2. Speed (the compounding investment)
- Dependency caching keyed on the lockfile hash (ContentAddressable, not timestamp); build caches (turbo remote / ccache / sccache) shared across runs.
- Parallelize across files/machines; split the test suite by duration (longest-first scheduling); containerized services (postgres/redis) as sidecars, installed once.
- The metric: pipeline minutes per PR and p50 PR feedback time. Both tracked; regressions treated as build breakage.

## 3. Flaky tests (the trust destroyer)
- Quaratine mechanism: flaky test detected (retry-pass) -> auto-filed -> quarantined (runs but doesn't block) with a FIX-BY date. Quarantine without a deadline is a graveyard.
- No blanket auto-retry of whole stages: it converts real flakiness signal into green noise. Retry once, count the retry-pass as flaky, surface the list every week.
- Flakiness triage order: timing/sleep-based waits -> shared state/ordering -> network mocks -> real nondeterminism (see concurrency-debugging).

## 4. Security of the pipeline itself (it holds the keys)
- Secrets: OIDC federation to cloud providers instead of long-lived keys; scope per-repo; no secrets in PR-from-fork jobs (untrusted code never touches secrets — GitHub `pull_request_target` is the classic footgun).
- Pin action versions to SHAs; audit third-party actions like dependencies. Build provenance (SLSA) for released artifacts.

## 5. Deploy gates (main is always releasable)
- Trunk-based: main green = deployable artifact produced on merge; feature flags gate incomplete work (long-lived branches are the alternative that never ships).
- Deploy automation: artifact -> staging auto -> prod on approval or on green smoke. Rollback = redeploy previous artifact, tested monthly like a fire drill.
- Post-deploy verification automated: smoke tests + error-rate watch with auto-rollback trigger (error budget breach = automatic revert, human confirms later).

## 6. Verify the pipeline (it's software too)
- The pipeline has tests: a failing-commit drill (deliberately broken change must fail CI), a green-main drill (pipeline passes on an empty change — cache correctness), and a rollback drill per release train.
- Metrics reviewed monthly: duration trend, flake rate, failure classification (real bug / flaky / infra).

## Pitfalls
- CI as the only test environment: if tests only run in CI, feedback is in minutes-not-seconds and everyone pushes-and-hopes. Pre-commit hooks run stage 1 locally.
- Nightly-long full suites nobody reads: red for 3 weeks = the suite is a horoscope. Fix or delete; an unreliable gate is worse than none.
- Copying another project's pipeline YAML: pipeline topology follows YOUR stage costs and risk profile — design, then encode.
