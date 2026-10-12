# Mochi Onboarding — cozy first-run setup

One command wires up everything mochi found from your other agents:

```bash
mochi onboard            # interactive (asks once, safe defaults)
mochi onboard --yes      # accept all: providers + skills + MCPs
mochi onboard --skip-skills --skip-mcp   # keys only
mochi onboard --force    # overwrite existing skills/config
mochi setup / mochi welcome              # aliases
```

## What it does

1. **Welcome** — cozy hello, what setup covers, 60-second promise.
2. **Providers & keys** — scans `process.env` + `./.env` + `~/.mochi/.env` +
   `~/.hermes/.env` for real keys (placeholders like `your-key`, `YOUR_*_HERE`,
   `hi`, `<…>` are ignored). Picks a primary (free tiers first) and builds a
   cross-provider `failover` chain so a cooling provider never kills a task.
   Writes to `~/.config/mochi/config.json` (never overwrites your primary
   unless `--force`).
3. **Models** — one model per job (fast / coding / reasoning / review).
   Change anytime: `/model` or `mochi use <provider> [model]`.
4. **Skills** — counts `SKILL.md` trees in
   `~/.hermes/skills`, `~/.claude/skills`, `~/.gemini/antigravity-cli/skills`,
   `~/.cursor/skills-cursor`, `~/.codex/skills`, `~/.mochi/skills`.
   Imports via the skill-importer (namespaced, non-destructive).
5. **MCPs & tools** — merges `mcpServers` from `.mcp.json`, `~/.claude.json`,
   `opencode.jsonc`, `~/.gemini/settings.json`, `~/.codex/config.toml`
   into mochi's config (existing entries win).
6. **Editors** — points to `editors/vscode` + `editors/jetbrains`
   (both speak `mochi acp`).
7. **Done** — writes `~/.config/mochi/onboarded.json` so the hello never
   pops up again. Revisit anytime with `mochi onboard` or `/onboard`.

## TUI

- First launch ever (not onboarded, no prompt): cozy banner + counts +
  `Type /onboard to import…`.
- `/onboard` / `/setup` / `/welcome`: renders the same frames in-chat.
- Headless apply: `mochi onboard --yes`.

## Files

- `src/onboarding/detect.ts` — pure scanners (never throw, keys masked).
- `src/onboarding/import.ts` — marker + apply logic.
- `src/onboarding/wizard.ts` — pure cozy frames + defaults.
