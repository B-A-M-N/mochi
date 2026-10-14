---
name: reading-unfamiliar-code
description: Get productive in an unfamiliar codebase fast — entry points, call graphs, and the five-question map. Use when onboarding to a new repo or subsystem.
---
# Codebase Onboarding Procedure

## Trigger / when to use
Load when you have just inherited an unfamiliar codebase (new job, new repo, new subsystem) and need to become productive without reading it top to bottom.

## Approach
1. **Find the entry point first**: the main function, the CLI command handler, the HTTP router, the worker loop — where execution starts. Everything else hangs off this.
2. **Trace one real request end-to-end**: pick a representative user action and follow it from entry to storage and back. This reveals the actual architecture faster than any diagram.
3. **Map the five questions**: what are the core domain objects, where do they get created, where do they get stored, what are the invariants, and what are the extension points? Answer these and you can navigate anything.
4. **Read tests as documentation**: the test suite encodes the intended behavior and the sharp edges. Read the tests for the module you are about to change before you change it.
5. **Make a small, safe change first**: a typo fix, a comment, a one-line cleanup — it forces you to run the build and tests and learn the workflow without risking much.

## Pitfalls
- Reading every file top to bottom — you will forget the beginning by the time you reach the end.
- Trusting the comments over the code — comments drift; code is the truth.
- Starting a big refactor before understanding the invariants — you will break the one thing the code secretly guarantees.

## Verification
You can draw the system's main components and their relationships on one page; you can explain what a representative request does end-to-end; you have made and verified a small change using the repo's own build and test commands.
