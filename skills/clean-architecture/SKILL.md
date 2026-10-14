---
name: clean-architecture
description: Structure systems with dependencies pointing inward — entities, use cases, interfaces, and frameworks at the edges. Use when building systems that must survive changing frameworks, UIs, and databases.
---
# Clean Architecture Procedure

## Trigger / when to use
Load when designing a system meant to outlive its current framework, database, and UI — the goal is that none of those can reach into the core.

## Approach
1. **Dependencies point inward**: outer layers depend on inner layers, never the reverse. The domain layer has zero imports from frameworks, databases, or HTTP.
2. **Four rings, inside out**: entities (business objects), use cases (application logic), interface adapters (controllers, presenters, gateways), frameworks & drivers (the UI and DB live here, outermost).
3. **Define interfaces at the boundary**: the use case needs storage, so it defines an interface; the database implements it. The business rule never sees the SQL.
4. **Deliver data, not dependencies**: crossing a boundary uses plain data structures, not entities — this is what keeps the inner ring reusable and testable.
5. **Let the dependency rule police every import**: if an inner module imports an outer one, the design is wrong. Enforce it in review, not by convention.

## Pitfalls
- Putting business logic in controllers or the database.
- "Hexagonal" with everything depending on everything — boundaries that are not enforced are decoration.
- Skipping the architecture because "it is just a CRUD app" — the CRUD app is where frameworks change fastest.

## Verification
No inner-layer module imports an outer-layer one; every outer layer is swappable without touching the core; use cases are testable without a database or web server.
