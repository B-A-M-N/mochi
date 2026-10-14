---
name: assumptions-documentation
description: Surface, label and verify the assumptions a change rests on so hidden bets become explicit and removable. Use in specs, PRs and incident reviews.
---
# Assumptions Documentation Procedure

## Trigger / when to use
Load when writing or reviewing a spec, PR or runbook, when "we assumed" shows up, or when a review disagreement traces to unstated premises.

## Approach
1. **List every assumption the change relies on** ("DB stays up", "inputs well-formed", "tier-1 users only"). If you cannot list it you are not aware of it yet.
2. **Tag each as verifiable or trusted**: verifiable ones get a test or monitor; trusted ones get an owner and an accepted-risk line.
3. **Make assumptions reviewable separately** from conclusions - reviewers cannot object to what they cannot see.
4. **Re-check after incidents**: for every incident, name the assumption that let it in; tighten or remove it.
5. **Keep the file close to the code** - a spec line is a forecast until someone reads it near the change it constrains.

## Pitfalls
- Styling assumptions as facts in the description.
- Assumption lists with no owner: they migrate into permanent folklore.
- Over-documenting low-risk premises - aim for the ones whose failure costs money, trust or data.

## Verification
Each assumption is labeled verified-or-trusted, has an owner when trusted, and the negative space (what we do NOT assume) is stated for the top risks.
