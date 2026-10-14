---
name: walking-skeleton
description: Prove a multi-component system end-to-end with the thinnest possible slice (real wiring, fake behavior) before building features. Use to start new services or pipelines.
---
# Walking Skeleton Procedure

## Trigger / when to use
Load at the start of a new multi-component build, when integration risk dominates feature risk, or after a project "worked in pieces" but never ran end to end.

## Approach
1. **Wire the thinnest path through every layer**: request in, response out, every hop real; behavior is stubbed.
2. **Prove it runs on the real target** (not localhost-with-mocks if production differs).
3. **Use stubs with named seams**: each fake exposes the real interface so replacement stays mechanical.
4. **Grow one real component at a time**, keeping end-to-end green after every commit.
5. **Hold a continuous demo**: runnable after every increment or it is not a real skeleton.

## Pitfalls
- Skipping a layer in the skeleton and discovering it at the deadline.
- "Wiring everything" that never actually deploys.
- Stubs that leak impossible abstractions.

## Verification
A single command boots the full path in the target environment, exits ok, and emits a marker per layer.
