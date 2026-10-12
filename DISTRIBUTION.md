# Show HN draft — Mochi v0.24.0

**Title:** Show HN: Mochi – open-source coding agent with 73 bundled deep-procedure skills

**Post:**

Hi HN — I built Mochi, an open-source terminal coding agent: Node 22+, zero runtime dependencies, Rust native core for the hot paths.

What makes it different from Claude Code / OpenCode / Aider:

- **73 bundled deep-procedure skills** (vs ~10 for most agents). Each is a full workflow — real commands, numbers, pitfalls, verification loops — not a one-line description. `mochi skills search <query>` finds and loads them on demand; community skills publish to a marketplace repo.
- **Adaptive token budgeting.** Tool schemas are advertised per task kind: coding tasks get a ~20-tool lean tier, chat tasks get 4. A trivial question costs ~3.9k tokens end-to-end, not 13k. The model can pull any deferred tool back mid-run via `load_tools`.
- **`mochi apply`** — atomic multi-file patch application. Parses a unified diff, validates every hunk against the working tree, applies all-or-nothing with rollback. Never trusts partial application.
- **26 model providers** out of the box (OpenAI, Anthropic, Bedrock, free endpoints, local llama.cpp/vLLM...), with failover and per-provider cooldowns.
- **Persistent goals** — `mochi` runs multi-step tasks as resumable goals with checkpoints, `mochi rollback` restores any snapshot, `mochi trace` replays the run.

Cold start: 0.11s. One-shot task end-to-end: ~3s including the model round trip.

Repo: https://github.com/xanstomper/mochi
Install: `curl -fsSL https://raw.githubusercontent.com/xanstomper/mochi/main/install.sh | bash`

Happy to answer questions about the skill format, the tiering system, or the goal/checkpoint model.

---

# README demo GIF — shot list (for recording)

1. `mochi -p "explain this repo's architecture in 3 bullets"` — one-shot speed
2. `mochi "add a retry decorator to src/client.ts, verify with npm test"` — goal mode with live tool calls
3. `mochi skills search docker` — marketplace search
4. `mochi apply fix.diff` — atomic apply, then a deliberately-failed apply showing rollback
5. `mochi checkpoint save before-refactor` / `mochi rollback`

Record with asciinema → agg (SVG/MP4), 80x24, paste into README under a "60-second demo" heading.

# HN fire checklist

- Post Tuesday–Thursday, 8–10am ET (best traffic window)
- First comment = the post above, submitted by you (not a brand account)
- Have answers ready for: "how is this different from Claude Code?" (skills depth + token tiering + open providers), "why zero deps?" (supply-chain trust + cold start), "does it phone home?" (no telemetry)
