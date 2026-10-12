---
name: release-engineering
description: Cut releases safely — versioning, changelogs, tagging, binary/asset builds, publishing to registries, and post-release verification. Use when preparing a release, publishing a package, or building a release pipeline.
---

# Release Engineering Procedure

A release is a promise that the artifact is exactly what the repo says it is. Everything below serves that promise.

## 1. Version and content freeze
- SemVer, decided by the DIFF not the mood: breaking = major (removed flags, changed output shape, dropped platform), additive = minor, fixes = patch. When in doubt about a behavior change, it's at least a minor.
- Changelog from the merge commits / conventional-commit history, edited for humans: what changed, who benefits, migration steps for breaking changes. "Misc fixes" is banned — every user-visible change listed.
- Freeze window: no feature merges after the release branch cuts; fixes only, cherry-picked.

## 2. Release branch and tag
- Branch `release/v1.2.3` from main; run the FULL suite (not the changed-files subset) + the release gate (`npm run release:check` equivalent: build + tests + tarball inspection).
- Tag on the release commit AFTER checks pass: annotated tag, signed when possible (`git tag -s`), message = changelog digest.
- The tag is the source of truth: artifacts build FROM the tag (CI), never from a dirty working tree. Verify `git status` clean + `git describe --exact-match` on the build host.

## 3. Artifacts
- Binaries: static where possible, one per supported platform/arch (matrix), checksums (SHA256) + signature file published alongside. Test the binary smoke-runs on each platform in the matrix (fresh container, not your dev box).
- Packages: tarball inspection BEFORE publish (`npm pack --dry-run` / `twine check`) — no dev files, no secrets, correct `files:` allowlist, version bumped everywhere (package.json + baked constants).
- Container images: multi-arch (buildx), digest pinned in release notes, SBOM generated (`syft`) for anything users deploy.

## 4. Publish sequence
- Registry publish (npm/PyPI/crates) from CI, not a laptop. Provenance/attestations enabled where the registry supports it.
- GitHub release: notes = changelog section, artifacts attached, checksums in the notes body.
- Announce AFTER everything is verifiably downloadable: the announcement links to real, tested install commands (`npm install -g pkg@latest` in a clean container, verify version).

## 5. Post-release
- Watch: install errors, crash reports, regression issues for 24-48h. The rollback plan (revert + patch release, or deprecate the bad version on the registry) is written BEFORE publishing, not during the incident.
- Deprecation discipline: never `npm unpublish` — publish a patch with the fix and deprecate the broken version.

## Pitfalls
- Releasing from a laptop: your machine has credentials, state, and artifacts the tag doesn't describe. CI or nothing.
- Forgetting the version bump in a baked constant (binaries reporting the old version) — grep the tree for the previous version string before tagging.
- Publishing under LATEST before the smoke matrix finishes: `latest` is a gun; point it only after verification.
