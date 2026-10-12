# Mochi Support

## File an issue

https://github.com/xanstomper/mochi/issues — one problem per issue, include:

1. `mochi --version` output.
2. `mochi doctor` output (add `--probe` if the problem involves providers/editors).
3. `mochi acp --check` output for any editor/ACP problem.
4. The Output log: VS Code → `View → Output → Mochi`; JetBrains → tool-window
   log; CLI → `~/.mochi/logs/crash.log` if present.
5. Minimal repro steps (command + smallest input that triggers it).

Security-sensitive? Open a blank issue titled "security" and ask for a
private channel instead of posting keys, tokens, or customer code.

## Discussions / questions

https://github.com/xanstomper/mochi/discussions — setup help, ideas, show-and-tell.
Check `docs/ONBOARDING.md` and `docs/EDITORS.md` first; most setup questions
are answered there.

## What to attach

| Symptom | Attach |
|---|---|
| Agent misbehaves in editor | `mochi acp --check` + Output log |
| Provider / auth failure | `mochi doctor --probe` (keys are redacted automatically) |
| Crash / hang | `~/.mochi/logs/crash.log` + command line |
| Onboarding / setup | `mochi doctor` `onboard` row + `~/.config/mochi/onboarded.json` presence |

Do not paste raw API keys — `mochi config` output is already redacted, but
double-check before posting.
