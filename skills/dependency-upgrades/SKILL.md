---
name: dependency-upgrades
description: Upgrade dependencies safely (npm/pip/cargo/go): audit first, update in layers, verify with the repo's own suite. Use when asked to update, bump, or audit dependencies.
---

# Dependency Upgrade Procedure

## 1. Audit before touching anything
- JS: `npm audit --omit=dev`, `npm outdated`. Python: `pip list --outdated`. Rust: `cargo audit`. Go: `go list -u -m all`.
- Record the baseline: which majors are behind, which have known CVEs. Never upgrade blind.

## 2. Update in layers, smallest blast radius first
- Patch + minor first (`npm update`, `cargo update --precise` per crate), verify, commit.
- Majors ONE at a time, reading the breaking-change notes first. A 10-major single commit is undebuggable.

## 3. Lockfiles are the deliverable
- Commit `package-lock.json` / `Cargo.lock` / `poetry.lock` with the change. A version bump without the lockfile is half a change.
- Never hand-edit a lockfile; regenerate with the package manager.

## 4. Verify with the repo's own suite
- Run the full test/typecheck/build after each layer. A green suite is the only proof the upgrade is safe.
- If the suite was already red, capture the baseline first so pre-existing failures aren't blamed on the upgrade.

## Pitfalls
- Upgrading test tooling and app deps in one commit hides which broke what — separate them.
- `latest` tags in CI (actions, docker) drift silently; pin versions, bump deliberately.
- Major upgrades of frameworks (React, Django, Rails) need their codemods run (`npx @react/codemod`, `django-upgrade`) before the suite means anything.
