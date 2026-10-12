---
name: provider-registration
description: Adding a model provider end-to-end — typed client, auth flow, model list, env var, tests. Use when wiring new LLM providers (OpenRouter, Groq, Bedrock, etc.).
---

# Provider Registration

Each provider is a small typed client + auth flow + model catalog entry. OpenCode beats Mochi on provider breadth; this procedure closes that gap one provider at a time.

## Trigger
- New provider requested (check the OpenCode/audit list first: OpenRouter, Groq, Together, Fireworks, DeepInfra, Azure, Bedrock, GitHub Models).
- Provider API change or new auth method.

## Steps
1. API shape: most providers are OpenAI-compatible chat/completions. If so, subclass/parametrize the existing OpenAI-compatible client — do NOT fork it. Only Anthropic/Bedrock-style APIs get a real adapter.
2. Registration in `src/providers/`: id, display name, default base URL, auth env var names, model catalog (id, context window, cost hints).
3. Auth: `mochi login <provider>` flow — token from env var or interactive prompt, stored in the keyring/config, never logged.
4. Model listing: `mochi models` must show the catalog with availability (token present or not).
5. Streaming: verify SSE streaming works (chunk parsing, usage accounting, [DONE] sentinel).
6. Tests: fixture-based client tests (recorded responses), auth-flow test, and a config test that the env var wiring resolves.

## Pitfalls
- OpenRouter model ids are `vendor/model` — pass through untouched, never slugify.
- Context windows differ per model — wrong context math causes silent truncation mid-session.
- Rate limits/headers differ (x-ratelimit vs anthropic-ratelimit) — surface 429s as retryable with backoff, don't crash the loop.
- Don't hardcode API versions in the client; put them in the provider config so they're updatable without code changes.

## Verification
- `npx vitest run src/providers/` green.
- Live smoke: set the env var, `mochi -z "say hi"` through the new provider, confirm streaming + usage line.
- `mochi login --help` lists the new provider.
