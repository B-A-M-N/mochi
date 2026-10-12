---
name: game-dev-features
description: Implement game features — game loops, entity systems, collision, state machines, save systems, and performance budgets at 60fps. Use when building a game, porting a mechanic between engines, or debugging game-specific problems (jank, physics glitches, save corruption).
---

# Game Feature Implementation Procedure

Games are real-time systems with players who exploit everything. Every feature ships with a performance budget and a cheat-proofing pass.

## 1. The game loop is the contract
- Fixed-timestep update (e.g. 60Hz) + variable render: physics deterministic, visuals smooth. Never tie game logic to frame rate — `deltaTime` capped (e.g. <=50ms) so alt-tab doesn't teleport entities through walls.
- Simulation state separated from presentation state: replay systems, netcode, and save games all fall out of this separation for free.

## 2. Entities and state
- Data-oriented where it matters (thousands of entities): arrays of components beat trees of objects — cache locality is your frame budget.
- State machines for anything with modes (enemy AI, player states, screens): explicit states + transitions beat boolean soup. Debug: log transitions, render current state name.
- Never trust `instanceof` chains for game logic — tags/components queried by type beat inheritance hierarchies (composition from day one).

## 3. Collision and physics
- Broad phase (spatial hash/grid) before narrow phase — O(n^2) collision checks don't ship.
- Tunneling: fast objects swept-test (raycast between positions) or substep. "Went through the wall" is a timestep bug, not a collision bug.
- Determinism for replays/netcode: fixed-point or carefully ordered float ops, seeded RNG, no wall-clock reads in simulation.

## 4. The frame budget (16.6ms at 60fps)
- Measure per-system (trace/profiler): gameplay <4ms, physics <4ms, render prep <3ms, leave headroom. The profiler BEFORE micro-optimizing — draw calls and allocations dwarf algorithm tweaks.
- Allocation discipline: pool projectiles/particles/effects; per-frame garbage collection spikes are the classic mobile jank.
- Loading: async scene loads with progress, assets compressed per platform, nothing blocking the main thread.

## 5. Save systems (corruption-proof)
- Versioned schema from save v1 (a `version` int + migration chain) — you WILL change the format.
- Atomic writes: write temp file, fsync, rename. Two-slot rotating saves for extra safety.
- Never save object references/pointers — save IDs; rebuild pointers on load. Save corruption reports should trigger a backup-slot recovery, not a crash.

## 6. Porting mechanics between engines (the discipline)
- Extract the INVARIANT (what the mechanic IS: tick rates, state transitions, damage formulas) from the engine-specific skin (rendering, input mapping).
- Re-implement against the target engine's idioms (its state machine, its physics step), port test cases (the observable behavior), and diff behavior side-by-side with the original before polishing.

## Pitfalls
- Coupling logic to render order or frame count: breaks on any refresh rate and makes replays impossible.
- Floating-point network sync without a determinism plan: two machines diverge by frame 1000.
- Cheats as bugs: any score/damage/position computed client-side is moddable by the player — server-authoritative for anything competitive.
