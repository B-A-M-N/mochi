---
name: auth-implementations
description: Implement authentication correctly — session/JWT/OAuth/SSC flows, password handling, MFA, and the failure modes that become breaches. Use when adding login/signup, fixing auth bugs, designing SSO, or reviewing an auth implementation.
---

# Authentication Implementation Procedure

Auth is where "it works" and "it's correct" diverge most. The failure modes are silent (tokens that never expire, sessions that survive email change) and the fixes are known — apply them mechanically.

## 1. Choose the credential model (by product shape)
- Session cookies (httpOnly, Secure, SameSite=Lax): the default for anything browser-first — logout works, XSS can't read the token, size is tiny.
- JWT: only when a stateless verifier is genuinely needed (API-to-API, multi-service without shared store). Short-lived access (5-15 min) + rotating refresh; store claims minimal (sub, exp, scope) — JWTs are signed, not secret.
- OAuth/OIDC: for "sign in with X" and enterprise SSO — be the CLIENT first (Authorization Code + PKCE), run your own authorization SERVER only with a real reason (Authorization Code + PKCE always; implicit flow is deprecated, refuse it).

## 2. Passwords and credentials
- argon2id (or bcrypt cost >=12) with per-user salt; constant-time compare; NO composition rules, max length generous (>=64), check against breached-password lists at signup and change.
- Password reset: single-use token, <=30 min TTL, hashed at rest like a password, invalidates on use AND on password change; identical response for known/unknown email (no user enumeration anywhere in auth — login, signup, reset all return the same shape/timing).
- Rate limits per account AND per IP on every credential endpoint; exponential lockout (not permanent lockout — permanent is a DoS on your users).

## 3. Session lifecycle (where silent breaches live)
- Server-side session records with revocation (a row you can delete) even when tokens are JWTs (pair with a jti denylist or short TTL).
- Session fixation: new session ID on EVERY privilege change (login, password change, MFA enable). Old sessions invalidated on password change — with a "log out everywhere" option users can trust.
- Idle + absolute timeouts proportional to risk (banking ≠ forum); sliding renewal, not rolling invisibility.

## 4. MFA
- TOTP (RFC 6238) as the base; WebAuthn/passkeys as the upgrade (phishing-resistant, now the default recommendation). SMS as last resort (SIM-swap).
- Enforce MFA at login, not just enrollment; recovery codes generated at enrollment, single-use, hashed. MFA-bypass review: does the reset flow bypass MFA? (It must NOT — recovery-code challenge required.)
- Step-up auth for sensitive actions (password change, API-key creation): re-challenge, don't trust the session age.

## 5. OAuth client pitfalls (the real-world breach list)
- Validate `state` (CSRF) and `nonce` (replay) on every flow; check `iss` and audience on ID tokens; NEVER log tokens or codes; redirect URIs exact-matched (no prefix matching — open-redirect via redirect_uri is a classic).
- Token storage: browser = httpOnly cookie or memory only; localStorage = XSS-exfiltrated tokens. Native apps: system browser + PKCE, never webviews.

## 6. Verify (attack your own auth)
- Test matrix: expired token, revoked session, token from another user, replayed code, reset-token reuse, login-with-old-password, MFA-skip-via-reset, JWT alg=none/kid-confusion, missing state, prefix redirect match. Each is a one-line curl — the suite runs in CI forever.
- Audit-log every auth event (login success/fail, reset, MFA change, session revoke) with IP+UA — the breach investigation you haven't had yet starts here.

## Pitfalls
- JWT in localStorage "for simplicity": one XSS and every user's identity is stolen silently. Cookies with SameSite have their own CSRF story — pick one threat model and handle it completely.
- Email-as-identity assumptions: emails change (and get recycled). Use immutable user IDs internally; emails are login labels with a verified flag.
- Building SSO without reading the spec: OIDC has three flows and only one is correct for your shape — implement from the spec + a maintained library, never from a blog post.
