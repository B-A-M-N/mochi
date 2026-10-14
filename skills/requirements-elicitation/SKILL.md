---
name: requirements-elicitation
description: Turn vague requests into testable requirements — clarify the ask, expose hidden assumptions, and define acceptance criteria before coding. Use when a task is ambiguous or acceptance is unclear.
---
# Requirements Elicitation Procedure

## Trigger / when to use
Load when the ask is ambiguous ("make it faster", "add auth"), when acceptance criteria are missing, or when you notice yourself guessing what the user meant.

## Approach
1. **Restate the ask in observable terms**: "faster" → "search under 200ms for 10k docs"; "add auth" → "users sign in with email+password, sessions last 7 days". If you can't observe it, it isn't a requirement yet.
2. **List the assumptions you're making and confirm them**: every ambiguous request hides 2-3 assumptions (which users? what data? what happens on failure?). Surface them, and when they're cheap to confirm, ask.
3. **Define the boundary**: what's in scope, what's explicitly not. Unstated scope is where half the argument at review time comes from.
4. **Write acceptance criteria as checks**: each criterion is one sentence a test (or a person) can pass/fail. "Handles errors well" fails this; "a 500 response retries twice then surfaces the status code" passes.
5. **When it's cheap, ask; when asking is expensive, state your assumption and proceed**: an explicit stated assumption beats a silent guess, and a reversible build beats a blocked day.

## Pitfalls
- Solving the literal request when the underlying goal differs (they asked for a button; they wanted fewer clicks).
- Gold-plating: adding requirements nobody stated.
- Treating acceptance criteria as a formality to write after the code — that's a description, not a contract.
- Endless clarification on a two-line task — calibrate the question budget to the task's cost.

## Verification
Before implementing, read your restated requirements aloud: each has an observable check, a stated scope boundary, and named assumptions. If any criterion can't be turned into a test or a demo step, rewrite it.
