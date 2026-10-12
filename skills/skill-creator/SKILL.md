---
name: skill-creator
description: Create new Mochi skills that pass the quality bar — trigger design, procedure density, pitfall mining, and catalog registration. Use when asked to write a skill for Mochi (or any agent's skill format), or when a repeated successful procedure should become a skill.
---

# Skill Creator Procedure

A skill is compressed experience: triggers that fire at the right moment, steps that survive contact with real problems, pitfalls that save the next run from the same blood.

## 1. Earn the skill first
- A skill exists because a procedure succeeded 2+ times or cost >30 minutes to discover. One-off tasks don't become skills; recurring pain does.
- Name the trigger scenario precisely: "use when X fails with Y" beats "use when relevant to X". The description IS the router — write it as the phrase a user (or agent) would actually emit.

## 2. Structure (Mochi format)
- Frontmatter: `name` (kebab-case, matches directory), `description` with explicit "Use when..." triggers. The description is the ONLY thing the relevance gate sees at recall time — front-load the trigger vocabulary (error strings, tool names, file types).
- Body: numbered phases, each with imperative steps carrying REAL commands, real file paths, real flags. No "investigate the issue" filler — every step is executable or it is cut.
- Verification phase: how you PROVE the procedure worked (test command, expected output). Skills without verification loops create false done-states.
- Pitfalls section: 3-6 entries, each a specific mistake with its consequence. "Be careful" is not a pitfall; "X silently does Y, check Z first" is.

## 3. Density rules (what separates a great skill)
- Every line earns its place: a step that an expert does reflexively without prompting gets cut; a step that encodes a non-obvious ordering constraint stays.
- Numbers beat adjectives: "<16ms per frame" not "fast"; "4.5:1 contrast" not "accessible".
- Negative space matters: what NOT to do and why (the anti-pattern list) prevents the most expensive failures.
- Keep it under ~150 lines. A skill that needs a table of contents is a book, and books don't get loaded into context.

## 4. Registration and testing
- Place in `skills/<name>/SKILL.md`; run `npm run build` and `npx vitest run src/skills.catalog.test.ts src/tools/skills.test.ts` — the catalog test is the registry gate.
- Verify recall: `mochi skills search <trigger-phrase>` must surface it. If the search misses, the description lacks the trigger tokens — fix the description, not the test.
- Live-fire once on the actual problem class before pushing: a skill that was never executed is a hypothesis.

## 5. Maintenance
- When a skill misfires or misses steps in use, patch it the same session (staleness compounds). The catalog test + description tokens keep the registry honest.
- Description drift is the #1 failure mode: as the procedure evolves, re-read the description and update triggers to match.

## Pitfalls
- Skills that narrate ("this skill will help you...") instead of instructing — cut all preamble; start at phase 1 step 1.
- Copying another agent's skill verbatim: port the invariants (see feature-port skill), adapt commands to the host environment, keep nothing that references the host's tools.
- Over-broad triggers: a skill that fires on half the requests dilutes recall for everything else. Tighten the description until the trigger boundary is sharp.
