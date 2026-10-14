---
name: technical-writing
description: Write documentation engineers actually read — READMEs, API docs, ADRs, and runbooks with the right level of detail. Use when writing or reviewing any technical document.
---
# Technical Writing Procedure

## Trigger / when to use
Load when writing or reviewing docs: READMEs, API references, architecture decision records, runbooks, onboarding guides, or any document whose job is to make a stranger productive.

## Approach
1. **Write for the reader's next action**: every doc opens with what the reader can DO after reading it (run it, call it, decide it). Background comes after the payoff.
2. **Match depth to decision**: a README is a front door (5 minutes to first success); an API reference is a lookup table (exact signatures, no prose); an ADR is a decision record (context, options, consequences). Don't write an ADR when a README is needed.
3. **Show, then tell**: one correct example beats three paragraphs of explanation. Examples must be copy-pasteable and current — a wrong example is worse than none.
4. **Structure for scanning**: headings that are statements ("Retries are idempotent"), not nouns ("Retries"). Tables for comparisons, numbered steps for sequences, warnings in callouts.
5. **Maintain ruthlessly**: a doc that drifts from the code becomes a lie. Link docs to the code they describe, regenerate examples from tests, and delete pages nobody reads.

## Pitfalls
- Documenting implementation instead of intent — readers want the contract, not the internals.
- "Temporary" placeholder sections that become permanent.
- Writing for yourself instead of the least-experienced reader.

## Verification
A new team member can complete the doc's primary task (build, call, decide) using only the doc, without asking anyone. Every example is executable and every link resolves.
