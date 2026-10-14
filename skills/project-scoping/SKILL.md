---
name: project-scoping
description: Scope software projects into deliverable slices — vertical slicing, MVP definition, cut lines, and honest sizing. Use when planning a build, splitting work, or facing a vague 'build X' request.
---
# Project Scoping Procedure

## Trigger / when to use
Load when turning a project idea into executable work, when a plan feels unstartable, or when a task keeps growing past its deadline.

## Approach
1. **Define the smallest useful thing**: the thinnest version that delivers real value to one real user. Everything else is a candidate slice, not a requirement. Write it as one sentence with an observable outcome.
2. **Slice vertically, not horizontally**: "login + dashboard + one report end-to-end" beats "all of the backend, then all of the frontend" — a vertical slice is demonstrable and integrates the risky parts early.
3. **Find the riskiest assumption and test it first**: the part most likely to invalidate the plan (a third-party API, a performance envelope, an unknown library) goes into slice one, not slice five.
4. **Draw the cut lines explicitly**: label each item must/should/could with what its absence costs. The cut line is a decision made now, calmly — not a panic at deadline.
5. **Size in ranges with reasons**: "half a day because it mirrors the existing export path" beats "2 days". Size after the slices exist; sizing before is guessing with a number attached.

## Pitfalls
- Building the framework before the feature — abstractions before the second real use case are speculation with a compile step.
- Horizontal slices that integrate at the end, where all risk lives.
- Scope that grows because nobody said no — the cut line erodes one "small addition" at a time.
- Sizing the happy path and forgetting the edges (migrations, error states, rollback) — they are half the work.

## Verification
Write the slice list as tickets, each demonstrable in isolation, with the riskiest first. If you can't picture a demo for slice one, the scope is still horizontal — reslice.
