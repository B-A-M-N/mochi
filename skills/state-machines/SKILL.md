---
name: state-machines
description: Model complex state as explicit machines instead of boolean flags — illegal states unrepresentable, transitions validated, and bugs caught at the type level. Use for workflows, connection handling, or multi-step UI.
---
# State Machines Procedure

## Trigger / when to use
Load when a system has more than two interacting booleans (`isLoading`, `isError`, `hasRetried`), a workflow with steps that can be revisited, or a bug report involving "it got stuck" or "it shouldn't be able to do that here".

## Approach
1. **Enumerate states and draw the transitions on paper first**: `idle → fetching → success | failure | retrying`. If a transition is hard to name, the states are probably wrong.
2. **Make illegal states unrepresentable**: one discriminated union field (`status: 'idle' | 'fetching' | 'error'`) beats three booleans — with booleans, `isLoading && isError` is legal and meaningless; with a union, the compiler rejects it.
3. **Put transition logic in one place**: a single `send(state, event) → state` function (or xstate machine). Scattering `if (isLoading && !hasError)` across handlers is where drift bugs breed.
4. **Guard the edges**: reject impossible events explicitly (log-and-ignore vs throw). A silent ignore hides the bug that produced the event.
5. **Give every terminal state an exit**: stuck states (permanent `error` with no retry) are machines that forgot a transition.

## Pitfalls
- Encoding the state in two places (a boolean and an enum) that drift apart under load.
- adding a boolean for the case you forgot — that's the second boolean of the next tangle.
- Deep-nesting the transition table until it's unreadable — flatten with nested machines for sub-workflows.

## Verification
Exhaustively test transitions: every legal event from every state, plus explicit tests that illegal events are rejected. If the state count is under ~8, write the table out and eyeball that every state has a way out.
