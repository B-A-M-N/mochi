---
name: event-driven-architecture
description: Design systems around events — producers, consumers, and the event contract that decouples them. Use when building reactive, scalable, or loosely coupled systems.
---
# Event-Driven Architecture Procedure

## Trigger / when to use
Load when building systems where actions must trigger side effects across boundaries — notifications, integrations, audits — without the trigger knowing who cares.

## Approach
1. **Name events in the past tense**: `OrderPlaced`, `PaymentFailed` — an event is something that already happened, a fact, not a command. This keeps producers and consumers decoupled.
2. **Define the event contract as a versioned schema**: the producer owns the event's shape; consumers subscribe to what they need. A breaking event is a breaking contract.
3. **Guarantee delivery, not order**: make events idempotent (consumers must handle duplicates) and design for at-least-once delivery. Total order across partitions is a trap.
4. **Choose the broker for your consistency needs**: Kafka for log-based replay, queues for work distribution, pub/sub for fan-out. They are not interchangeable.
5. **Close the loop with observability**: every event needs a correlation id, a producer trace, and a dead-letter path for what cannot be consumed.

## Pitfalls
- Commands disguised as events ("DoPayment") — this re-couples producer and consumer.
- Events as integration database — consumers reaching back into the producer's schema.
- At-most-once delivery that silently drops events under failure.

## Verification
Every event is a named fact with a versioned schema; consumers are idempotent and tested against duplicates; a replay of the event log reconstructs state; failures route to a dead-letter queue with an owner.
