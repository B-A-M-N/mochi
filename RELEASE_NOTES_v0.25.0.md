# v0.25.0 — Providers, Density & Trust

**Headline:** 32 model providers, 24 verified MCP servers, 84 lint-clean skills, real per-provider auth — and the Windows CI leg green for the first time ever.

## Providers (21 → 32)

- Moonshot/Kimi, MiniMax, Zhipu GLM, Z.AI, Cohere, Alibaba Qwen — every endpoint and model id verified against current docs the day it shipped.
- Dead-default cleanup: Cerebras listed an id it never served; freeinference/onboarding/failover pointed at a 404ing Kimi revision. All replaced with live models.
- New invariant test: every default must be a listed model, or the suite fails. The dead-default class cannot recur.

## MCP registry (12 → 24)

- Playwright, Context7, Tavily, Firecrawl, Exa (hosted), Supabase, Neon, GitLab, Google Maps, EverArt, AWS KB, Kubernetes. Every npm package checked live on the registry — six candidates 404'd and were cut rather than shipped hopeful.
- Brave migrated off its deprecated package; new URL transport for hosted servers; registry-integrity test (one transport, hints, unique ids).
- `mcp test` handshakes any server before you rely on it.

## Skills (72 → 84) + download trust

- 12 new deep procedures: dependency-upgrades, e2e-testing, webhooks, worker-queues, serverless-functions, load-testing, terraform-iac, logging-standards, jupyter-notebooks, shell-scripting, sdk-design, zero-downtime-deploys.
- No new infrastructure was needed: clone → register → search → install-by-name → pack/unpack plus the TUI browser already existed. What was missing was trust: installs now run the skill-lint gate (prompt-injection payloads rejected, quality notes reported), and the repo ships a `packs.json` seed catalog.
- The lint gate itself was fixed twice: it rejected the library's own `## N.` step style and any skill that named TODOs to prohibit them.

## Auth that proves itself

- `mochi login` and `/login` live-probe the key before storing (per-kind: OpenAI `/models`, Anthropic versioned read, Gemini key-param read). Rejected keys are never persisted; unreachable endpoints store with a warning; 429 counts as proof.
- `mochi auth status [--probe]` shows key sources across all providers without printing key material; `auth logout` clears stored keys.
- Tested-but-unwired RFC 8628 device-flow engine for future OAuth (wiring without registered app IDs would be fake — documented as such).

## Prompt bloat, cut with receipts

- Research/plan/document turns advertised all ~65 tool schemas (~10K tokens/call); new READ tier advertises 16 (~2K). Coding stays lean (21), chat stays minimal (7, and keeps `search` again).
- Measured per-tier schema weights during review; skills stay top-6-descriptions with bodies on demand; providers/MCPs cost zero per call by construction.

## Windows CI: green, finally

- The leg that never completed in 60+ runs now finishes in minutes: the `cmd.exe` interactive-start hang is fixed (`/d /s /c` recipe), plus platform contracts across exec, shell, cron, permissions, verification, SDK, retrieval, and the full test suite.
- Full suite: 1725 passed / 0 failed on ubuntu, macOS, and all 4 Windows shards. Coverage ratchet held by adding tests, never by lowering floors.

**Install:** `curl -fsSL https://raw.githubusercontent.com/xanstomper/mochi/main/install.sh | bash`
**Publish:** `cd ~/mochi && npm login && npm publish --access public`
