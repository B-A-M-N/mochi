---
name: inversion-reasoning
description: Solve problems by flipping the goal - work backward from failure modes to unguarded edges, instead of forward from happy paths. Use for design hardening and stuck problems.
---
# Inversion Reasoning Procedure

## Trigger / when to use
Load when a design stalls, when reviewing a plan before committing, or when "how do we make this happen" produces nothing useful.

## Approach
1. **State the inverse goal**: instead of "ship the feature safely", ask "what would make this ship catastrophically". List concrete catastrophes.
2. **Work backward through each**: for each catastrophe, what single change or assumption would let it through? Mark those as unguarded edges.
3. **Invert the fixes**: each unguarded edge names its guard; put the guard at the earliest layer, not the crash site.
4. **Combine with direct planning**: inversion names missing guards; it does not replace design. Run both, take the union of concerns.
5. **Know limits**: strongest against omission failures; weakest for judgment-heavy tradeoffs. Do not invert forever.

## Pitfalls
- Treating every inverted concern as a must-fix - some are acceptable risks, priced and accepted on record.
- Inverting without shipping: this is an audit technique, not a product strategy.
- Doing inversion alone, without those who own the consequences.

## Verification
Every named catastrophe maps either to a guard in the design or to an explicit accepted-risk note with an owner and a revisit trigger.
