---
name: webhooks
description: Webhook receivers done right: signature verification, idempotency, async processing, replay. Use when asked for webhooks, Stripe/GitHub handlers, or event ingestion.
---

# Webhook Receiver Procedure

## 1. Verify the signature first, parse second
- Every provider signs differently (Stripe `Stripe-Signature` + timestamp tolerance, GitHub `X-Hub-Signature-256`, Svix `svix-*`). Look up the exact scheme — never trust the body unauthenticated.
- Reject skew: check timestamps (5-minute window) to kill replay attacks. Return 401 on any mismatch, log the attempt.

## 2. Acknowledge fast, process async
- Respond 200 within seconds (providers retry and then disable you). Push the payload to a queue/job table and return.
- Store the raw payload BEFORE processing — when handling logic has a bug, you replay from stored payloads instead of asking the provider to resend.

## 3. Idempotency on the event id
- Dedupe on the provider's event id (`idempotency_key` / delivery id column, unique constraint). At-least-once delivery means you WILL get duplicates.
- Make handlers re-runnable: processing the same event twice must be a no-op, not a double charge.

## 4. Test with real signatures
- Use provider CLIs (`stripe listen --forward-to`, `gh webhook forward`) or replay captured payloads — never hand-craft a "valid" signature in tests.
- Cover: valid, wrong signature, stale timestamp, duplicate delivery, unknown event type (log + 200, never 500).

## Pitfalls
- Returning 4xx/5xx for events you don't understand causes retry storms — unknown types get 200 + a log line.
- Secret rotation: support two active secrets during rotation windows, or every rotation drops events.
