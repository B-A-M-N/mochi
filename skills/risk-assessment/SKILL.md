---
name: risk-assessment
description: Assess and mitigate risk before shipping — failure mode enumeration, premortems, blast radius, and rollback planning. Use when shipping changes with real consequences.
---
# Risk Assessment Procedure

## Trigger / when to use
Load before deploys, migrations, destructive operations, dependency upgrades, or any change where "we'll fix it if it breaks" isn't actually true.

## Approach
1. **Enumerate failure modes concretely**: for each change ask "how does this fail?" — wrong data, partial application, timeout, total outage, silent wrongness. Silent wrongness is the one to fear most; rank it highest.
2. **Run a premortem**: "it's two weeks later and this shipped broken — what happened?" Write the three most plausible stories. They name the mitigations better than any checklist.
3. **Bound the blast radius**: who and what is affected, how many users/rows/files, and is it reversible? Irreversible changes (deletes, migrations, publications) need a rehearsed rollback, not a hope.
4. **Mitigate by reversibility, not prediction**: prefer changes you can undo in one step (feature flag, blue/green, staged rollout) over changes you claim will work.
5. **Define the abort criteria before starting**: the specific signal that makes you stop and roll back, decided while calm. Deciding mid-incident is deciding badly.

## Pitfalls
- Confusing unlikely with impossible — the mitigations for impossible events never get rehearsed.
- Risk registers that list everything at "medium" — that's a way to avoid deciding.
- Mitigations that add their own failure mode (a retry loop that amplifies a rate limit).
- Skipping the assessment because the change "looks small" — most outages come from small changes that interact.

## Verification
Before the change lands: every failure mode has either a mitigation or an explicit accepted-risk note, the rollback is rehearsed or provably one-step, and abort criteria are written down and specific.
