---
name: security-audit
description: Defensive security audit procedure for codebases — dependency risk, secrets, auth patterns, injection surfaces, and hardening review. Use when auditing a repo before release, reviewing a PR with security-sensitive changes, or hardening an existing service.
---

# Security Audit Procedure

Audit like an attacker with the source code. Work top-down: secrets and deps first (cheapest, most common), then auth design, then injection surfaces, then hardening.

## 1. Secrets and credentials (always first)
- Grep the tree and git history: `git log -p | grep -iE "(api[_-]?key|secret|token|password)"` — history leaks survive file deletion.
- Check `.env*` files are gitignored, CI logs don't echo secrets, and test fixtures use only throwaway values.
- Any real credential found: rotate FIRST, clean history second. Rotation order matters.

## 2. Dependencies
- `npm audit` / `pip-audit` / `cargo audit`; triage by reachable code path, not CVSS alone — a prototype-pollution lib you never call with user input is a low finding.
- Check for typosquatting on direct deps (name diffs by one character) and install scripts (`postinstall`) in newly added packages.
- Lockfiles committed; ranges pinned; a dependency abandoned >2 years with a known CVE gets a replacement plan, not a waiver.

## 3. Auth and access design
- Passwords: argon2id/bcrypt, never md5/sha. Reset tokens: single-use, short TTL, hashed at rest.
- Session cookies: Secure, HttpOnly, SameSite. JWTs: algorithm pinned (no `none`), short-lived, refresh rotation.
- Every endpoint: who can call it? Walk the role matrix — authorization checks must be server-side per-resource, not UI-gated.

## 4. Injection surfaces
- SQL: parameterized only. String-built queries fail the audit even behind an ORM.
- Command exec: any `exec`/`system`/`spawn` with interpolated input. Shell-free APIs (`execFile`, arrays) or bust.
- XSS: `innerHTML`/`dangerouslySetInnerHTML`/`v-html` usage — each needs sanitization justification. Template auto-escaping is the default; every bypass documented.
- Path traversal: `join(base, userPath)` is not safe — resolve and prefix-check.
- Deserialization of untrusted data (yaml.load, pickle, php unserial) — safe loaders only.

## 5. Hardening review
- Security headers: CSP, HSTS, X-Content-Type-Options, frame-ancestors. CORS: explicit origins, never `*` with credentials.
- Rate limiting on auth and expensive endpoints; input size caps everywhere.
- Error responses leak stack traces or schema internals? Fix. Logs contain tokens/PII? Fix.
- CSRF protection on state-changing routes; audit signed URLs for TTL and scope.

## 6. Report format
- Findings ranked: Critical (exploitable now) / High / Medium / Low / Info. Each: location (file:line), exploit scenario, fix with a diff, and effort estimate.
- Explicitly list what was checked and found CLEAN — a negative result is a result.

## Pitfalls
- Scanner-only audits: tools cover ~20% of real findings; design flaws (authz, trust boundaries) need reading the code.
- Auditing the new feature while the skeleton (auth, session, deploy config) predates everyone's memory.
- Trusting client-side validation as a security control. It is UX, not security.
