---
name: domain-driven-design
description: Model complex domains with bounded contexts, aggregates, and domain events. Use when building business software with complex rules and many interacting concepts.
---
# Domain-Driven Design Procedure

## Trigger / when to use
Load when building business software where domain complexity (not technical complexity) is the main challenge — many interacting rules, many stakeholders, and a domain experts must understand the code.

## Approach
1. **Find the bounded contexts**: split the domain into sub-domains that share a language and can evolve independently. The boundary is the point where a word changes meaning — "product" in sales ≠ "product" in inventory.
2. **Model the aggregate root**: each consistency boundary has one root entity that enforces invariants. Everything outside the aggregate references the root by identity, never by reaching through it.
3. **Make implicit concepts explicit**: value objects (money, date ranges), domain events ("OrderPlaced"), and repositories turn buried logic into named, testable building blocks.
4. **Keep domain objects persistence-ignorant**: the domain knows nothing about databases. Map between domain and infrastructure at the repository layer.
5. **Use a ubiquitous language**: the code's names come from the domain expert's vocabulary. If the business says "release", the code says `release()`, not `setStatus(LIVE)`.

## Pitfalls
- Anemic domain models — entities are dumb data bags and all logic lives in services; this is a transaction script wearing a DDD costume.
- Giant aggregates that lock the whole graph for one field change.
- Modeling everything — DDD pays for complexity, not for a CRUD app.

## Verification
Each bounded context has a clear name and boundary; every invariant is enforced inside an aggregate; a domain expert can read the core model and recognize the business; no domain object imports a database or framework type.
