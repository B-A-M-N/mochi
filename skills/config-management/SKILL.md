---
name: config-management
description: Manage configuration correctly across environments — env var precedence, secrets handling, validation at startup, and config layering. Use when adding config, secrets, or environment handling.
---
# Config Management Procedure

## Trigger / when to use
Load when adding settings, handling API keys, supporting multiple environments, or debugging "works locally but not in CI/production" configuration issues.

## Approach
1. **Validate config at startup, fail loudly**: parse and check every required setting in one place before any work begins. A missing key discovered mid-run wastes an hour; one discovered at boot wastes a second.
2. **Establish explicit precedence**: defaults (lowest) → config file → environment variables → CLI flags (highest). Document it; users and future-you will assume different orders.
3. **Never put secrets in code or committed config**: keys, tokens, and passwords come from the environment or a secret store, and gitignore the files that hold them. A committed secret is a leaked secret — rotate it, don't just delete the commit.
4. **Type the config, don't scatter strings**: parse raw input into a validated object once (`parseInt`, boolean coercion, URL validation) instead of reading env strings at every use site.
5. **Log the effective config, redacted**: at startup print what's in effect (with secret values masked) — most "why is it doing that" questions are config questions answered by this one line.

## Pitfalls
- Truthiness traps: `FLAG=false` is the string "false" (truthy!) — coerce booleans explicitly.
- Different config keys in different environments — the same setting spelled two ways.
- Reading env vars deep in library code — it makes the library untestable and the config flow invisible.
- `.env` files committed "just for the example" — the example key is a placeholder someone will use in production.

## Verification
Test the precedence chain (a value set in each layer resolves to the winner), assert startup fails with a clear message on missing required config, and grep that no secret value appears in logs or committed files.
