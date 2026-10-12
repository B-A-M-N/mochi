---
name: payments-integration
description: Integrate payments correctly — Stripe-class gateway patterns, webhook reliability, idempotency, subscription lifecycle, and reconciliation. Use when adding checkout, subscriptions, billing, or payouts; when money moves, this procedure applies.
---

# Payments Integration Procedure

Payment bugs are either embarrassing (double-charge) or existential (revenue silently lost). Every rule below exists because someone learned it in an incident review.

## 1. Use the gateway as the source of truth
- Stripe/PSP objects (Customer, Subscription, Invoice, PaymentIntent) are the LEDGER; your DB stores MAPPINGS (PSP ID <-> your user/plan) and display caches — never re-implement billing state.
- Money as integer minor units (cents) with currency code; never floats. Currency handled at the PSP; conversions/amounts recomputed server-side from YOUR price table, never trusted from the client (client-sent amounts are a "pay $0.01" bug).

## 2. Checkout flow (the canonical shape)
- Server creates the Checkout Session/PaymentIntent with amount from your catalog; client confirms; result lands via webhook — the redirect/thank-you page is NOT the source of success (users close tabs mid-redirect).
- Idempotency keys on every write call (create-intent, refund, capture) — retries after timeouts are routine, and payment APIs retry harder than you expect.
- 3DS/SCA: the flow may leave and return (or fail asynchronously) — handle `requires_action`, pending states, and late failures as first-class paths, not exceptions.

## 3. Webhooks (where integration correctness lives)
- Verify signatures (timing-safe); respond 2xx FAST and process async (queue) — webhook handlers that do real work time out and the PSP's retries pile up.
- Idempotent handlers (dedupe by event ID — the PSP delivers at-least-once); event ordering NOT guaranteed: use object state + event timestamps, not sequence.
- Local dev: CLI forwarding with seeded fixture events; CI: contract tests replaying recorded event JSON per event type — the handler that only ran against happy-path `payment_intent.succeeded` has never been tested.
- Reconciliation job: daily diff of PSP charges vs your orders table — the missing-webhook drift this catches is the silent revenue leak.

## 4. Subscription lifecycle (the state machine that generates tickets)
- Model states explicitly: trial -> active -> past_due -> canceled (and paused where supported). Map EVERY webhook event to a transition; unknown events log loudly, not silently no-op.
- Dunning: retry schedule per PSP defaults, pre-dunning email, clear grace behavior (is the user locked out at past_due or active-with-banner? DECIDE and write it down).
- Proration/upgrades/downgrades: compute expected proration in tests against the PSP's preview API — "what will the customer be charged" is a testable claim.
- Cancellation: self-serve, immediate-confirmation, and the data-retention question answered BEFORE the first cancel request.

## 5. Failure handling and abuse
- Declined payments: specific, actionable user messaging per decline code (expired card vs insufficient funds); a saved-card-retry path; never a generic "error" for money problems.
- Refunds/disputes: dispute webhook freezes the workflow and alerts a human (disputes have deadlines); refund paths idempotent and logged.
- Test clocks (Stripe) or PSP sandboxes for the FULL lifecycle in CI: trial -> dunning -> cancel in minutes, not months.

## 6. Verify
- The reconciliation test: create N subscriptions in sandbox, fire every lifecycle event, assert your DB matches the PSP's state at each step.
- Idempotency test: deliver each webhook twice; assert zero double-effects.
- Amount round-trip test: display amount == charged amount == receipt amount, in every supported currency (decimal/comma locale traps live here).

## Pitfalls
- Trusting the client success redirect: the user's network dies between payment and redirect — webhook is the only truth.
- Storing card data yourself: unless you ARE a PSP with a compliance team, tokenized vaults only — touching PANs is a compliance project, not a feature.
- Handling only the happy-path webhook: `invoice.payment_failed` arriving at 3am with no handler is how subscriptions silently churn.
