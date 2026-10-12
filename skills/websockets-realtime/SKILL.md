---
name: websockets-realtime
description: Build real-time features — WebSocket/SSE transport choice, connection lifecycle, reconnection with backoff, backpressure, and scale-out via pub/sub. Use when adding chat, live updates, collaboration, notifications, or any push channel to an app.
---

# Real-Time Features Procedure

Real-time systems fail differently: the connection is a pet that dies constantly, and every server instance sees a different slice of truth. Design for both from the first line.

## 1. Transport selection (by need, not fashion)
- Server->client one-way (feeds, notifications, progress bars): **SSE** — plain HTTP, auto-reconnect built in, proxy-friendly, no protocol upgrade fights. Default choice.
- Bidirectional (chat, multiplayer, collaboration): **WebSocket**. Only go further (WebRTC data channels) for P2P latency requirements.
- Polling is not a sin: >30s staleness tolerance or extreme simplicity needs = poll and sleep well.

## 2. Connection lifecycle (where all the bugs live)
- Client reconnect with exponential backoff + jitter, resubscription state machine, and a resume cursor (`Last-Event-ID` for SSE, sequence numbers for WS) — reconnect MUST NOT lose or duplicate messages across the gap.
- Heartbeats: ping/pong every 30s; dead TCP connections haunt load balancers for 10+ minutes without them. Miss 2 pongs = client-initiated reconnect.
- Server: idle connection GC, per-connection send queue with a hard cap — a slow client must not buffer your server into OOM.

## 3. Backpressure and ordering
- The server that sends faster than the client drains is a memory leak with extra steps: bounded queues, drop-oldest for ephemeral data (presence, tickers), block/close for guaranteed-delivery data.
- Ordering: per-connection ordering guarantees only. Cross-entity global order requires a sequence authority (single writer or logical clock — Lamport/vector clocks for merges).
- Idempotent message handling on the client (dedupe by message ID) — the retry/reconnect dance WILL deliver some messages twice.

## 4. Scale-out (the single-box ceiling)
- Connections are sticky to an instance; broadcasts need a fan-out layer: Redis pub/sub, NATS, or Postgres LISTEN/NOTIFY for modest scale. The publish goes to the bus; every instance pushes to its own local connections.
- Presence (who's online) is a TTL problem: heartbeats refresh a keyed TTL, absence expires it. Never store presence as long-lived truth.
- Horizontal-readiness test in staging: 2+ instances, message published via instance A delivered to a client on instance B.

## 5. Delivery semantics (decide explicitly per message class)
- At-most-once (ticker prices): drop on overflow. At-least-once (chat): persist before ack, client dedupes. Exactly-once: a lie at the infrastructure level — achieve it as at-least-once + idempotent consumer, and say so in the design doc.
- Persistence for replay: chat/notifications land in a store first, fan-out second — reconnect replays from the store, not from memory.

## 6. Verify (real conditions, not happy path)
- Kill the connection mid-stream (proxy timeout, laptop sleep, network flap) — client recovers with zero loss, no dupes, no zombie UI state.
- Load test: 10k connections per instance with realistic subscribe patterns; measure memory per connection and fan-out latency at the 99th percentile.
- The tab-background test: browsers throttle timers in background tabs — heartbeats and reconnects must survive setInterval throttling (use visibilitychange to force-reconnect on return).

## Pitfalls
- WebSocket through corporate proxies/CDNs without testing: many strip or time out upgrades — SSE with a poll fallback reaches more users than a pure-WS architecture.
- Broadcasting from a request handler to an in-memory channel in a multi-instance deployment: works in dev, silently delivers to 1/N of users in prod.
- JSON parse errors crashing the connection handler: one malformed frame shouldn't kill every user's socket — per-message error boundaries.
