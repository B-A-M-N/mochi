---
name: daemon-endpoints
description: Adding HTTP endpoints to the persistent daemon — auth, persistence, job lifecycle. Use when extending src/daemon/ or wiring external clients to the daemon.
---

# Daemon Endpoints

The daemon is a persistent agent over localhost HTTP with bearer-token auth. Every endpoint follows the same contract.

## Trigger
- New daemon capability (job type, status surface, control action).
- External client (editor plugin, script) needs daemon access.

## Steps
1. Route in `src/daemon/server.ts`: verb + path under the existing prefix, JSON in/out, errors as `{ error: string }` with correct status code (400 client, 401 auth, 404 unknown, 409 conflict, 500 fault).
2. Auth: every route passes through the bearer-token middleware — no exceptions, including "read-only" ones.
3. Persistence: job state changes go through the existing store layer so they survive daemon restart. Never keep authoritative state only in memory.
4. Wire the lifecycle: created → running → done/failed must be observable from `mochi daemon jobs` immediately.
5. Add a client method to the daemon client module, then a CLI subcommand if user-facing (`mochi daemon <sub>`).

## Pitfalls
- Port reuse after stop: SO_REUSEADDR handling exists — don't open raw listeners.
- Long-running work must not block the event loop — spawn or queue it, return 202 with a job id.
- Never log bearer tokens or prompt bodies at info level.

## Verification
- `npx vitest run src/daemon/` green.
- Manual: start daemon, exercise the new route with curl (no token → 401; with token → expected body), restart daemon, confirm state persisted.
