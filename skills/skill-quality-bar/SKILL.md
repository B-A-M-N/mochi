---
name: skill-quality-bar
description: The quality bar for skills that ship with Mochi — triggers, numbered steps, pitfalls, verification. Use when writing or reviewing any skill in skills/.
---

# Skill Quality Bar

A skill is executable procedure knowledge, not an essay. Every shipped skill must pass this bar.

## Trigger
- Writing a new skill.
- Reviewing a community skill for the registry.
- Auditing the bundled catalog.

## Steps
1. Frontmatter: `name` (kebab-case) and `description` that states WHEN to use it — the description is what the loader matches on, so it must contain the trigger conditions.
2. Body structure, in order: **Trigger** (when this applies), **Steps** (numbered, concrete, with file paths and exact commands), **Pitfalls** (specific mistakes with consequences), **Verification** (how you know it worked).
3. Every step must reference things that exist in this repo (paths, module names, commands). A skill referencing tools Mochi doesn't have is a cull offense.
4. Length: 40–80 lines. Under 30 lines means it's generic advice — cut it. Over 150 means split it.
5. One skill = one procedure. If the title contains "and", it's probably two skills.

## Pitfalls
- Leaked system prompts from other products (Canmore, research_kickoff_tool, SOUL.md personas) — never, they burn context and can't execute here.
- Marketing language ("leverage", "cutting-edge") — a skill is a procedure, write it like a runbook.
- Duplicating an existing skill under a new name — check `mochi skills list` first.
- Generic language mastery ("expert Python tips") — the model already knows; only encode what's specific to this codebase.

## Verification
- `mochi skills list` shows it with a useful one-line description.
- A new session given only the skill text can execute the procedure without asking what a path means.
