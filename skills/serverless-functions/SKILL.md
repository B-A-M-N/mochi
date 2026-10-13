---
name: serverless-functions
description: Serverless functions (Lambda/Cloudflare Workers/Vercel): cold starts, bundling, env config, local emulation. Use when asked for serverless, edge functions, or lambda handlers.
---

# Serverless Function Procedure

## 1. Keep the handler thin, dependencies thinner
- Cold start is proportional to bundle size: tree-shake, avoid ORMs/clients you don't call, preferWeb-standard APIs on edge runtimes (no `node:fs` on Workers).
- Initialize clients OUTSIDE the handler (connection reuse across warm invocations); never connect-per-request.

## 2. Stateless by construction
- No local filesystem (ephemeral `/tmp` only, 512MB), no in-memory sessions, no background threads after return. State lives in KV/R2/Dynamo/Upstash, passed explicitly.
- Timeouts are hard kills: checkpoint long work (step functions / queues) instead of hoping for 15 minutes.

## 3. Env and secrets per stage
- Secrets from the platform store (Secrets Manager / Workers secrets / project env), never `.env` files in the bundle. Dev/staging/prod get separate values, same code.
- Fail fast on missing required env at boot with the variable NAME in the error — a cryptic undefined 3 calls deep wastes an hour.

## 4. Emulate locally, verify deployed
- `wrangler dev` / `sam local` / `vercel dev` for the inner loop; then hit the deployed URL with a real request (curl + a bad input) before declaring done.
- Log structured JSON (request id, duration, outcome) — printf debugging doesn't exist when you can't ssh in.

## Pitfalls
- Edge runtimes ban Node APIs: check the compatibility matrix before importing (`node:crypto` works most places, `node:fs` almost nowhere).
- Cron on serverless needs the platform scheduler (EventBridge / Cron Triggers), not setInterval — the process doesn't persist.
