---
name: spec-writing
description: Write technical specs that engineers can build from — problem statement, interfaces, edge cases, and open questions. Use before implementing anything larger than a few files.
---
# Spec Writing Procedure

## Trigger / when to use
Load when a change spans multiple files or sessions, when two people need to agree before building, or when "I'll figure it out as I go" has already produced two rewrites.

## Approach
1. **Problem before solution**: one paragraph of what's wrong or missing, with evidence (a trace, a user report, a failing test). Solutions invented without the problem get rebuilt.
2. **Specify interfaces, not implementation**: function signatures, data shapes, error classes, and state transitions — the contract others code against. Leave the internals to the builder.
3. **Enumerate edge cases explicitly**: empty, maximum, malformed, concurrent, and partial-failure inputs. Each edge named here is a bug that doesn't reach review.
4. **Separate decided from open**: mark the things you've concluded (with reasoning) and the questions that block or can proceed with assumptions. Reviewers should know which is which.
5. **Include the exit criteria**: how we know the spec is satisfied — commands run, tests passing, observable behavior. A spec without exit criteria is a wish list.

## Pitfalls
- Specifying implementation details that the spec can't know yet — it reads as authority and blocks better ideas.
- Writing the spec to match the code you already plan to write — that's documentation, not design.
- 20-page specs nobody reads: match length to reversibility; a two-file change wants a paragraph.
- Leaving error handling unstated because it's "obvious" — it never is.

## Verification
Hand it to someone (or yourself tomorrow) with zero context: they can state the problem, the contract, the edges covered, and what's undecided — without asking you anything. If they can't, the spec is incomplete, not the reader.
