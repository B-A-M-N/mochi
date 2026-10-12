# v0.24.0 — The 73-Skill Release

**Headline:** bundled skill library grown to **73 deep-procedure skills** (deepest of any CLI coding agent — Claude Code bundles ~10, Cursor none), `mochi mcp-serve` MCP server, and a **20x perf fix** on task latency.

## Performance

- **Fixed the 107-second task freeze.** Provider switch kept the default (opencode-zen) baseUrl while sending another provider's API key — every request auth-failed and the failover machinery burned its retry/cooldown budget (~100s) before failing with 0 tokens. Config now derives baseUrl/model/profiles from the provider table when switching providers. Also dropped the dead `kimi-k2.7-code` model from freeinference (endpoint 404s it). One-shot task: **107s fail → 5.2s success** (measured).

## Skills (43 → 73)

- Batch 2: +19 — frontend-design, document-generation, skill-creator, incident-response, database-migrations, browser-automation, refactoring, concurrency-debugging, accessibility-audit, caching-strategy, data-viz, release-engineering, api-integration, mobile-app-dev, game-dev-features, ml-app-integration, seo-technical, observability, api-security-hardening
- Batch 3: +7 — websockets-realtime, monorepo-tooling, internationalization, ci-pipeline-design, state-management, reverse-engineering-binaries, design-systems
- Batch 4: +4 — auth-implementations, feature-flags, payments-integration, docker-k8s

Every skill is a deep procedure: numbered phases with real commands, explicit pitfalls with consequences, and a verification loop — not one-liner descriptions.

## New: `mochi mcp-serve`

MCP stdio server exposing Mochi's tools over the Model Context Protocol — editor ubiquity (VS Code, JetBrains, Zed, Neovim) without bespoke extensions. Docs in `docs/EDITORS.md`.

## Command cull

Dead/novelty commands removed (chameleon, enhance, termix, …); completion list matches the real dispatcher.

## TUI (OpenCode parity)

- Rich multi-row bottom status bar, soft obsidian-black background
- Top session bar parity with OpenCode, animated status spinners
- Fresh session on startup, provider cooldown resilience

## Infrastructure

- Cross-provider auto-failover chain built from env keys (cooldown-aware, primary never in chain)
- Windows binary crash fix (fileURLToPath at import time)
- `.gitattributes` linguist-vendoring so repo language stats reflect the real codebase (TS + Rust), not committed site bundles
- Security test coverage 32% → 77%, tools 50% → 70%
- **Full suite: 1454 tests passing, 0 failed**

**Install:** `curl -fsSL https://raw.githubusercontent.com/xanstomper/mochi/main/install.sh | bash`
