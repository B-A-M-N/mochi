---
name: code-readability
description: Write code humans and models can read — naming, function size, comment policy, and reducing cognitive load. Use when reviewing code for clarity or refactoring for maintainability.
---
# Readability Procedure

## Trigger / when to use
Load when code "works but nobody understands it", during review for clarity, or when a function has grown past a screen.

## Approach
1. **Name what it is, not how it works**: `retryWithBackoff(fn)` beats `doFetchRetry`; the name should survive a refactor of the implementation. Bad names are the most expensive kind of comment.
2. **One function, one job**: if you can't say what a function does in one sentence without "and", split it. Aim for a screenful; longer functions hide the seams where bugs live.
3. **Comments explain why, the code shows what**: delete comments that restate the code; keep the ones that record constraints, surprises, and non-obvious decisions ("UTC because billing runs in local time").
4. **Reduce cognitive load at each point**: fewest simultaneous concepts per function, guard clauses over nesting, early returns over else-ladders. Depth is where readers lose the thread.
5. **Make it look like its neighbors**: match the file's conventions (naming, structure, error style) — consistency beats personal preference every time, because readers have already learned the local pattern.

## Pitfalls
- Clever code that saves lines and costs comprehension — the reader pays every time, you paid once.
- Comments that drift from the code — a wrong comment is worse than none.
- Abbreviations only the author knows (`usrMgr`) — spell it out.
- Refactoring for elegance when the requirement is clarity.

## Verification
Read it as a stranger: can you predict what each function does from its name and signature alone? Count how often you scroll back to understand a variable's meaning — each scroll is a naming or structure defect. Ask a reviewer what the code does before explaining it.
