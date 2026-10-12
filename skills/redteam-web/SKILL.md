---
name: redteam-web
description: Offensive security testing procedure for web apps and APIs — recon, auth bypass, injection, business-logic abuse, with strict authorization discipline. Use when asked to pentest, red-team, or find vulnerabilities in a target you are authorized to test.
---

# Web Red-Team Procedure

Authorized testing only: confirm the engagement scope (target list, rate limits, rules of engagement) before the first packet. Stop at any out-of-scope surface and report it.

## 1. Recon (passive first)
- Map the attack surface: subdomains (cert transparency, DNS dumps), tech fingerprinting (response headers, favicon hash, JS bundles), endpoints from JS files (`grep -E "(api|/v[0-9])/" app.js`).
- Enumerate auth flows: login, register, reset, OAuth callbacks, MFA. Auth is where logic bugs live.
- Archive everything: request/response pairs, timestamps, payloads. Findings without repro steps are noise.

## 2. Auth and session attacks (highest ROI)
- Registration/login: user enumeration via timing, response diffing, or reset-flow verbosity.
- Session: predictable IDs, missing rotation on privilege change, cookie flags (Secure/HttpOnly/SameSite), fixation after login.
- Access control: for every authenticated endpoint, replay it as a lower-privileged user (IDOR: swap `userId=1001` -> `1002`). BOLA is the most common API vuln — automate the matrix (role x endpoint).
- OAuth: redirect_uri validation, state CSRF, token substitution between accounts.

## 3. Injection classes (modern payloads)
- SQL: error-based first (`'`, `''`), then time-based blind (`1' AND SLEEP(5)--`); ORM apps still leak via raw query seams.
- NoSQL: `{"$ne": null}`, `{"$regex": "^a"}` password enumeration on JSON APIs.
- SSRF: any URL-fetching param -> internal metadata (`169.254.169.254`), internal admin panels, `file://`. DNS rebinding for filtered targets.
- SSTI: `{{7*7}}`, `${7*7}`, `<%= 7*7 %>` — detect the engine by which evaluates, escalate carefully.
- Deserialization: modified cookies/params that decode to base64 objects; verify with a benign payload (DNS pingback), never blind RCE guesses.

## 4. Business logic (no scanner finds these)
- Race conditions: parallel duplicate requests on coupon/redeem/transfer endpoints (HTTP/2 single-packet attack).
- Workflow skips: buy -> intercept -> skip payment step; negative quantities; currency/rounding abuse.
- Parameter pollution on rate-limited or priced fields (`price=0.01`, duplicate JSON keys).

## 5. Discipline and reporting
- Rate-limit yourself; the goal is findings, not a DoS. Never exfiltrate real data — prove access with redacted samples.
- Every finding: severity (CVSS), exact repro steps (curl command), impact narrative, remediation. A finding that isn't reproducible from your report doesn't count.
- Retest after fixes; regressions are common.

## Pitfalls
- Scanning before understanding: automated scanners bury logic bugs and can violate scope (destructive payloads).
- Chaining blindness: the real finding is the CHAIN (IDOR -> PII -> account takeover), not each isolated bug.
- Forgetting the API surface behind mobile clients — decompile the app or proxy it for hidden endpoints.
