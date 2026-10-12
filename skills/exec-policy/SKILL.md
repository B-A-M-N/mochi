---
name: exec-policy
description: Subprocess execution must go through the central exec policy — risk classification, timeout escalation SIGTERM→SIGKILL, output caps. Use when adding any code that spawns processes.
---

# Exec Policy

Every subprocess spawn in Mochi goes through the central policy layer. Raw `execFile`/`spawn` outside it is a review-blocker.

## Trigger
- Any new code path that shells out.
- Reviewing a PR that touches process execution.
- Hardening an agent-driven tool that runs commands.

## Steps
1. Route through the policy module: classify risk first (read-only / mutating / network / destructive). The classification decides gating, not the call site.
2. Always set a timeout. On expiry: SIGTERM, grace period, then SIGKILL. Never SIGKILL first.
3. Cap captured output (stdout+stderr); unbounded buffers OOM long sessions.
4. Set `cwd` explicitly — never inherit from the process when operating in a workspace.
5. Env: pass a minimal allowlist, never the full parent env (secrets leak into child crash dumps).
6. On failure, surface stderr in the error message — silent exit codes are undebuggable from traces.

## Pitfalls
- Shell interpolation of user input: pass argv arrays, never build strings for `sh -c` unless the policy module explicitly sanitizes.
- Zombie processes on SIGKILL: reap with the exit handler, don't detach and forget.
- Windows compat: no POSIX-only signals or paths in the policy layer itself.

## Verification
- Grep the diff for `child_process` imports outside the policy module — must be zero.
- Timeout test: spawn a sleeper, assert SIGTERM escalation and exit surfacing.
- `npx vitest run` full suite green.
