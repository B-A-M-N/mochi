---
name: decision-records
description: Record significant technical decisions as ADRs — context, options, consequences, and review dates — so choices survive memory loss. Use for architecture, library, or process decisions.
---
# Decision Records Procedure

## Trigger / when to use
Load when making a choice someone will question in six months (architecture, data store, auth model), or when a team keeps re-arguing a settled decision.

## Approach
1. **Write it as context, not opinion**: the situation, constraints, and forces that made this a hard choice. A record without context can't be evaluated when the context changes.
2. **One record, one decision**: split compound decisions ("use Postgres AND move to k8s") so each can be revisited and reversed independently.
3. **Record the rejected options with reasons**: the value of an ADR is mostly in what it rejected — future readers must not re-explore dead ends.
4. **State consequences honestly, including what got harder**: every decision trades something; the record is where that debt is named.
5. **Add a review trigger**: "revisit if writes exceed 10k/s or after v2 migration" — a decision without a revisit condition becomes folklore.

## Pitfalls
- Writing the record after implementation from memory — the reasoning gets retrofitted to the outcome.
- Status "approved" with no actual approver — name who decided.
- Records that never get revisited — link them from code comments and the review date.
- Bikeshed-level ADRs — record decisions that are expensive to reverse, not font choices.

## Verification
Each record passes the stranger test: someone with no context can reconstruct why the decision was made, what was rejected, and what would trigger a revisit. Keep it under a page; if it's longer, it's a discussion, not a record.
