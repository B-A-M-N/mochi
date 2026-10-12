---
name: incident-response
description: Respond to production incidents — triage, mitigation before root-cause, communication cadence, and postmortem discipline. Use when a service is down, error rates spike, users report outages, or an alert fires.
---

# Incident Response Procedure

Mitigation first, diagnosis second, blame never. Every minute of triage-order confusion multiplies downtime.

## 1. Triage (first 5 minutes)
- Quantify the blast radius: which endpoints/users/regions, since when, error rate vs baseline. One dashboard query or `curl` beats five theories.
- Classify severity: SEV1 = total outage/data at risk (page everyone, mitigation now), SEV2 = major feature down (mitigate within 30 min), SEV3 = degraded (ticket it).
- Declare the incident: single commander, single channel, timeline started. A commander who is ALSO fixing is not a commander.

## 2. Mitigate before diagnosing
- The fastest REVERSIBLE mitigation wins: rollback > feature-flag off > restart > scale-up > hotfix. Rollback is not defeat; users don't care about your root cause.
- Never debug in production when a rollback exists. Fix forward only when rollback is impossible (data migrations, protocol changes).
- Change one variable at a time; note each action with a timestamp in the timeline.

## 3. Diagnose (in parallel with mitigation)
- Recent-change bias: 70%+ of SEV1s trace to the last deploy/config change — diff the deploy list first.
- Follow the dependency: client -> LB -> app -> DB/cache -> third-party. Health-check each hop; the first failing hop is your suspect.
- Evidence over logs-eyeballing: correlate error timestamps with deploy times, metric inflections, and alert firing order.

## 4. Communicate
- Stakeholder updates every 15-30 min during SEV1: current status, actions taken, next update time. "Investigating" at minute 45 reads as silence.
- Status page BEFORE social media learns about it. Internal channel: facts only; speculation gets labeled speculation.

## 5. Verify recovery
- Error rate, latency, and saturation back to baseline for a sustained window (not one good minute). Watch for the retry-storm aftershock as backlogged clients drain.

## 6. Postmortem (within 72h, blameless)
- Timeline reconstructed from the incident channel timestamps, not memory.
- Root cause via 5-whys to a PROCESS failure, not a person: "no canary on the deploy pipeline" not "engineer pushed bad code".
- Every action item has an owner and a date; items that would have caught THIS incident rank first. Action items without dates are wishes.

## Pitfalls
- Hero-fixing in prod with no rollback plan: if the "fix" fails, you've made recovery strictly harder.
- Declaring recovery when the symptom stops: cascading failures pause and resume. Hold the sustained-window rule.
- Postmortems that list 12 action items: more than 5 means none will happen. Consolidate to the ones that block recurrence.
