---
name: postmortems
description: Run blameless postmortems — build the timeline, find contributing factors, and convert lessons into tracked actions. Use after incidents, failed releases, or notable bugs.
---
# Postmortem Procedure

## Trigger / when to use
Load after any incident, failed deploy, data-loss event, or notable production bug — especially when the same class of thing keeps happening and "we should be more careful" keeps being the conclusion.

## Approach
1. **Build the timeline from evidence, not memory**: deploy times, alert times, first-user-report, detection, mitigation, resolution — each from logs and timestamps. Memory rearranges events to fit the narrative.
2. **Blamess by construction**: describe what people did and why it seemed reasonable at the time. "Removed the guard rail to unblock the test" is a system fact; "dev was careless" is a story that prevents learning.
3. **Distinguish the trigger from the causes**: the trigger (one bad deploy) is rarely the whole story; the causes are the missing tests, absent guards, slow detection, and manual steps that made it possible and slow to fix.
4. **Convert every lesson into a tracked action with an owner**: a postmortem whose actions live only in the document changes nothing. Each action needs a ticket, an owner, and a done condition.
5. **Ask what made it worse, not just what caused it**: detection latency, rollback difficulty, and unclear ownership usually matter more than the root cause.

## Pitfalls
- Stopping at "human error" — every error has a system reason; find it.
- Actions that are aspirations ("improve testing") instead of verifiable changes.
- Postmortems only for big incidents — near-misses are free lessons with the same causes and none of the cost.
- Publishing blame by accident in the timeline's wording ("surprisingly", "ignored").

## Verification
Every contributing factor maps to at least one tracked action; the timeline contains no unexplained gaps; and nobody reading it could name a person as the cause. Count the actions that actually closed within a month — that's the real metric.
