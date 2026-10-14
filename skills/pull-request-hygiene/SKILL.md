---
name: pull-request-hygiene
description: Make PRs reviewers can act on - single intent, small scope, intent-first titles, reviewer briefing, CI doing boring checks. Use when opening or reviewing changes.
---
# Pull Request Hygiene Procedure

## Trigger / when to use
Load when preparing a PR, when a PR is stuck in review, or when "looks good to me" rubber-stamps hidden bugs.

## Approach
1. **Scope to one intent**, description "why" before "what". Split mixed-intent PRs; land the risky part first when possible.
2. **Keep the diff reviewable** - roughly under 400 meaningful lines; renames in a separate PR.
3. **Provide the reviewer briefing**: run command, tests that matter, risks, areas of uncertainty.
4. **Let CI carry boring checks** (format, lint, types, tests, security) before human review.
5. **Close every discussion item** with a code change or an explicit decision to leave it.

## Pitfalls
- Title "fix stuff" makes the PR unfindable.
- Force-pushing that wipes review context.
- Requesting review before self-review.
- One reviewer for everything regardless of area.

## Verification
A fresh reviewer can state the intent, risk surface, how to run it and what changed without asking. Automation green. Diff scope matches title.
