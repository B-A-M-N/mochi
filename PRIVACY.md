# Mochi Privacy Policy

No telemetry by default. Mochi runs locally; nothing phones home unless you
ask it to call a model.

## What leaves your machine

- **Provider API calls only.** When you run a prompt, the conversation +
  retrieved context is sent to the model provider you configured
  (e.g. OpenAI / Anthropic / Gemini / your custom endpoint). That is the
  only network traffic Mochi itself initiates for inference.
- **No tracking, no analytics, no telemetry.** No usage counters, no
  session contents, no file contents, no crash uploads. There is no
  telemetry flag because there is nothing to turn off.

## What stays local

- `~/.config/mochi/config.json` — providers, keys, MCP servers.
- `~/.config/mochi/onboarded.json` — onboarding marker.
- `~/.mochi/` — sessions, traces, skills, tool-route history.
- `~/.mochi/logs/` + `crash.log` — local diagnostics only, never uploaded.

## Opt out / delete

There is nothing to opt out of (no telemetry exists). To wipe local state:

```bash
rm -rf ~/.mochi/logs ~/.mochi/sessions  # diagnostics + sessions
rm -rf ~/.mochi                          # everything local
rm -rf ~/.config/mochi                   # config + keys + onboard marker
```

To stop future provider calls from leaving the machine, remove keys from
`~/.config/mochi/config.json` or point mochi at a local endpoint
(e.g. Ollama). `mochi doctor --probe` is the only command that makes
test network calls, and only when you pass `--probe` explicitly.
