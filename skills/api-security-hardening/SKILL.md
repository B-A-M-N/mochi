---
name: api-security-hardening
description: Secure web APIs and backends — authz enforcement, injection prevention, rate limiting, secret handling, and the OWASP-class checks that block real attacks. Use when hardening an API before launch, reviewing a service's security posture, or responding to a security finding.
---

# API Security Hardening Procedure

Security defects are architecture defects discovered by strangers. Work the checklist in attack order: identity, authorization, input, secrets, abuse.

## 1. Authorization (the #1 real-world API vuln — broken object-level authz)
- EVERY object access checks ownership/permission server-side: `getObjectForUser(id, userId)` — not fetch-then-filter. Test: user A's token against user B's resource IDs must 404 (not 403 — existence leaks).
- Mass-assignment: bind request bodies to explicit field allowlists; never direct-ORM-bind (the classic admin-flag injection).
- Tenant isolation enforced at the DATA layer where possible (row-level security / tenant column in every query), not only in app code.

## 2. Input and injection
- Parameterized queries ONLY (prepared statements) — string-built SQL/NoSQL/OS commands are instant fail. ORM raw-escape hatches get the same review as raw SQL.
- Output encoding by sink: HTML-escape for HTML, JSON-serialize for JS context, never build shell commands from user input (shlex/arg-array instead).
- File uploads: extension AND magic-byte check, size cap, stored OUTSIDE the webroot with random names, served with `Content-Disposition: attachment` and a content-type you set.

## 3. Auth mechanics
- Passwords: argon2id/bcrypt with per-user salt, constant-time comparison. Session/JWT: short-lived access tokens, httpOnly+Secure+SameSite cookies over localStorage, refresh rotation with reuse detection.
- Rate limiting at the identity level (per user/key/IP) on auth endpoints and expensive operations (the credential-stuffing and crypto-mining budget).

## 4. Secrets and transport
- Secrets from env/secret store; rotation tested (the rotation runbook is executed once before launch, not imagined). No secrets in logs, error traces, or client bundles — grep the built artifact before shipping.
- TLS everywhere including internal hops (mTLS or mesh where the threat model warrants); HSTS on public endpoints.

## 5. Abuse resistance
- Input size caps everywhere (body, header count, query depth for GraphQL), request timeouts, and pagination defaults — resource-exhaustion is an availability vulnerability.
- Webhook consumers: verify signatures (HMAC with timing-safe compare), validate the event type allowlist, idempotent handlers (providers retry).

## 6. Verify (attack yourself first)
- OWASP API Top 10 walkthrough per endpoint class; authz test suite (A-token-on-B-object matrix) in CI — the matrix test is the single highest-value security test you can write.
- Dependency audit (`npm audit`/`pip-audit`/`cargo audit`) in CI with an actual upgrade policy, not just reports.
- Security headers on responses: CSP (at least for any HTML), X-Content-Type-Options, frame-ancestors.

## Pitfalls
- 403 for forbidden vs 404: 403 confirms the resource exists — enumerate-friendly APIs get scraped by ID.
- Trusting the client on price/quantity/role: every server-side decision recomputed from server-side data.
- Security review once at launch then never: the authz matrix test in CI is what keeps it true as endpoints multiply.
