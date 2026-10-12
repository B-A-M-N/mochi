---
name: ml-app-integration
description: Integrate ML models and LLM APIs into applications — prompt/params management, streaming, evals, caching, fallback chains, and cost control. Use when adding AI features to an app, improving an existing LLM integration, or debugging model-powered features.
---

# ML/LLM App Integration Procedure

Model quality is only half the feature; the other half is the harness around it — fallbacks, evals, caching, and cost ceilings.

## 1. Provider abstraction (day one)
- Call models through ONE interface (your own thin client): model, params, prompt template, and provider are config, not hardcoded calls. Switching/fallback requires zero feature-code changes.
- Fallback chain: primary -> cheaper model -> graceful degradation (template response, feature-off flag). Chain tested with the primary endpoint forcibly failing.

## 2. Prompts are code
- Prompts in version-controlled templates with named slots; no string concatenation scattered in feature code. Every prompt change is a diff someone can review.
- Structured outputs: JSON schema + validation at the boundary; retry-on-invalid-schema ONCE with the validation error appended, then degrade.
- System vs user separation maintained; temperature per task class (extraction ~0, creative >0.7) recorded in the template header.

## 3. Evals BEFORE polish
- A golden set of 20-100 real inputs + expected properties (exact for extraction, rubric for generation) — the eval harness runs on every prompt/model change.
- Judge with code where possible (parse checks, unit conversions), LLM-as-judge only for subjective axes, and spot-check the judge monthly.
- Regression tracking: eval scores per commit; a prompt tweak that gains 2% on task A and loses 5% on task B is a bug, and only evals reveal it.

## 4. Cost and latency control
- Cache by prompt-hash (exact match) for identical inputs; semantic cache only for high-volume low-stakes traffic.
- Budget ceilings per feature/user/day enforced server-side; token counting before the call, not on the invoice.
- Streaming for anything generative (perceived latency > 3s fails UX); time-to-first-token as the tracked metric, not total time.

## 5. Safety and failure containment
- Input sanitization: user text is untrusted — never interpolate it into system prompts without delimiting; injection attempts logged.
- Output containment: no model output executed/rendered as HTML/raw SQL. Length caps, format validation, and a review path for user-visible failures.
- PII policy explicit: what leaves your boundary, redaction before the call where required.

## 6. Verify
- Load-test the feature: concurrency limits per provider tier, 429 handling with backoff, and the fallback chain under a full primary outage.
- Ship with the eval harness in CI (cheap subset on every PR, full set nightly).

## Pitfalls
- Prompt changes without evals: vibes-based iteration drifts silently and you find out from users.
- One provider hardcoded: outages and price hikes are certain; abstraction after the outage is expensive.
- Ignoring token bloat (whole-file context stuffing): context windows are money and attention — retrieve the relevant slice instead.
