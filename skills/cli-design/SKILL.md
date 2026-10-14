---
name: cli-design
description: Design command-line interfaces people can actually use — verb-first commands, discoverable help, honest exit codes, and pipe-friendly output. Use when building or revising a CLI.
---
# CLI Design Procedure

## Trigger / when to use
Load when creating a CLI, adding subcommands, or fixing a tool that "works but is confusing" — the user can't guess the flags, or output can't be piped.

## Approach
1. **Verb-first, noun-second**: `mochi login <provider>`, `mochi skills search <query>` — the action comes first so commands read as sentences and tab-completion groups by verb.
2. **Make help the primary documentation**: every subcommand answers `--help` with usage, examples, and exit codes. If the help is worse than the README, the help gets fixed, not the README.
3. **Exit codes that mean something**: 0 success, 1 user/operational error, 2 usage error (or your documented scheme) — and the help says which. Scripts and CI branch on these.
4. **Be pipe-friendly**: machine-readable output via a `--json` flag, human output by default, and diagnostics on stderr so `tool | jq` never breaks. Never print secrets or spinner frames to stdout.
5. **Fail with the fix, not just the error**: "no API key for groq — set $GROQ_API_KEY or run: mochi login groq" beats "missing configuration".

## Pitfalls
- Prompts in non-interactive contexts — detect `isTTY` and either use flags or fail, never hang waiting on input nobody can give.
- Flags that change behavior depending on position — keep parsing order-independent.
- Silent success (no output on success is fine only when Unix convention says so) — prefer a short confirmation.
- Adding a flag when a subcommand would be clearer — 15 flags is a design smell.

## Verification
Run every command with `--help`, `-h`, and bad input; assert exit codes are documented and consistent; pipe the output through `jq`/`head` to confirm stdout stays clean; run in a non-TTY (CI) and confirm no prompt hangs.
