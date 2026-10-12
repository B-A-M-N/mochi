# Mochi Publishing

How `@mochi/agent` and the editor plugins ship. Three channels, one version.

## Channels

### 1. npm — `@mochi/agent`

```bash
npm run build            # tsc → dist/
npm run build:native     # native binaries → native/bin
npm run release:check    # tarball + version gate (CI also runs --skip-tests)
npm publish --access public
```

`prepack` rebuilds `dist/` + natives + standalone binary so a clean-tree
publish never ships an empty tarball.

**`files` whitelist (package.json) — deliberate:**

```json
"files": ["dist", "!dist/**/*.map", "!dist/mochi-bin", "native/bin", "README.md", "LICENSE"]
```

- `dist` — the agent (`dist/cli.js` is the `mochi` bin, run under node).
- `!dist/**/*.map` — no sourcemaps in the tarball.
- `!dist/mochi-bin` — the ~96MB Bun-compiled standalone binary is
  **excluded**; it ships via GitHub releases, not npm.
- `native/bin` — stripped Rust helper binaries.
- `README.md` + `LICENSE` — required docs/legal.
- **`editors/` EXCLUDED** — the VS Code `.vsix` and JetBrains `.zip` ship
  through their own marketplaces (below), never inside the npm tarball.

### 2. VS Code — VS Marketplace + Open VSX

Extension root: `editors/vscode` (`mochi-vscode`, publisher `mochi`).

```bash
cd editors/vscode
npm install
npm run typecheck      # tsc --noEmit, must be clean
npm run compile
npx vsce package       # → mochi-*.vsix (install locally to smoke-test)
code --install-extension mochi-*.vsix
```

Publish (needs one PAT per registry):

```bash
npx vsce publish -p <VS_MARKETPLACE_PAT>        # VS Marketplace
npx ovsx publish mochi-*.vsix -p <OPEN_VSX_PAT> # Open VSX
```

PAT setup:

- VS Marketplace: Azure DevOps → Personal Access Tokens → scope
  `Marketplace (Manage)` → copy as `VS_MARKETPLACE_PAT`.
- Open VSX: https://open-vsx.org → account → Access Tokens → copy as
  `OPEN_VSX_PAT`.
- Never commit tokens. CI uses repository secrets of the same names.

Smoke before publish: `mochi acp --check` must print OK, then
`mochi setup vscode` probes the `code` CLI and prints install steps.

### 3. JetBrains Marketplace

Plugin root: `editors/jetbrains` (Gradle IntelliJ plugin).

```bash
cd editors/jetbrains
./gradlew buildPlugin   # → build/distributions/*.zip
./gradlew runIde        # manual smoke test (tool window → Send/Cancel)
```

Upload: https://plugins.jetbrains.com → Upload → attach the `.zip` →
fill changelog from `CHANGELOG.md` → Submit for approval.

Approval is manual (JetBrains review, usually 1–2 business days).
Do not cut the npm release notes until the plugin is approved, so all
three channels announce the same version.

## Version-sync checklist

`package.json` is the source of truth. `scripts/sync-version.mjs`
(`prebuild:bin`) propagates it; run it before every release:

```bash
node scripts/sync-version.mjs
node scripts/release-check.mjs
```

| # | File | What to sync |
|---|------|--------------|
| 1 | `package.json` `version` | Bump first (e.g. `0.23.0`). |
| 2 | `editors/vscode/package.json` `version` | Must match exactly (marketplaces reject drift). |
| 3 | `src/acp.ts` `ACP_AGENT_VERSION` baked constant | Fallback when `package.json` isn't on disk (compiled binary); runtime prefers `package.json` version. Keep the literal in step with the bump. |
| 4 | `CHANGELOG.md` | New `## [x.y.z] - YYYY-MM-DD` entry on top; older entries untouched. |

Also auto-synced by the script — verify, don't hand-edit:
`native/mochi_core/Cargo.toml` + `Cargo.lock` (`mochi_core` version).

Release order: bump → sync → `CHANGELOG` → `build` + `build:native` →
`release:check` → `npm publish` → `vsce`/`ovsx` publish → JetBrains upload.

## Ops specs (proposed, not yet implemented)

Pure spec — no code changes ship with this section.

### `mochi feedback`

- `mochi feedback --up|--down [--note "..."] [--crash]` appends one JSON
  line to `<repo>/.mochi/feedback.jsonl` (fallback `~/.mochi/feedback.jsonl`
  outside a repo): `{ ts, vote, note?, crash?, version, platform }`.
- Note capped at 2000 chars; never prompt interactively in `--crash` mode.
- `.mochi/` stays gitignored; the file is local-only, never uploaded.

### Update check

- At most once daily (timestamp in `~/.mochi/update-check.json`); skips when
  offline, when stdout isn't a TTY, or when `MOCHI_NO_UPDATE_CHECK` is set
  (any non-empty value).
- On newer npm version: one stderr line
  (`mochi vX.Y.Z available (have A.B.C) — npm i -g @mochi/agent`) and continue.
  Warn-only: never blocks, never auto-installs, exit code unchanged.

### Crash-report prompt

- On `uncaughtException` / `unhandledRejection`: write `~/.mochi/logs/crash.log`,
  print the path + `mochi doctor` hint, and offer (TTY only, single line):
  `Run 'mochi feedback --crash' to log this locally? [y/N]`.
- Default No; `--crash` attaches only `{ error, stack }` trimmed to 4KB —
  no prompts, no file contents, no keys (reuse `redactObject`).
