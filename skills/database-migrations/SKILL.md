---
name: database-migrations
description: Design and execute safe database schema migrations — expand/contract pattern, zero-downtime rules, rollback plans, and data-backfill discipline for PostgreSQL/MySQL/SQLite. Use when changing schemas, adding columns/tables/indexes, or migrating data at scale.
---

# Database Migration Procedure

Schemas change live. Every migration is written to run while the app is serving traffic, and every migration has a reverse plan.

## 1. Classify the change first
- Additive (add nullable column, new table, new index): low risk — still follow the index rules below.
- Destructive (drop column/table, rename, change type, add NOT NULL): NEVER single-step. These require the expand/contract pattern.
- Data backfills: separate from schema migrations, batched, idempotent, resumable.

## 2. Expand / contract (for destructive changes)
- Phase 1 (expand): add the new column/table as nullable or with a default; ship code that writes BOTH old and new shapes, reads old.
- Phase 2 (backfill): batched update (`WHERE new_col IS NULL LIMIT 1000` loops), idempotent, safe to interrupt. Monitor replica lag between batches.
- Phase 3 (switch reads): code reads the new shape. Verify parity first (dual-read compare in a canary).
- Phase 4 (contract): only AFTER no deployed code reads the old shape — remove old column in a separate deploy. Two deploys minimum between expand and contract.

## 3. Zero-downtime hard rules
- Locks: `ALTER TABLE ADD COLUMN` is fine on modern Postgres; `ADD COLUMN ... NOT NULL DEFAULT <non-constant>`, `ALTER TYPE`, and `ADD CONSTRAINT` take ACCESS EXCLUSIVE — use `NOT NULL DEFAULT` constants, or `ALTER TABLE ... VALIDATE CONSTRAINT` pattern (add as NOT VALID, validate separately).
- Index builds: `CREATE INDEX CONCURRENTLY` (Postgres) or online DDL (MySQL 8) always; never plain CREATE INDEX on a hot table. CONCURRENTLY can't run in a transaction — handle the INVALID index left by a failed build.
- Rename = add new + dual-write + move reads + drop old. Renames are contract changes for every query and cache.

## 4. Every migration ships with
- Rollback: the down-migration must actually work against the post-expand state (dropping a column you already contracted out of loses data — that's why contract is last).
- Lock timeout: `SET lock_timeout = '5s'` so a migration that can't get the lock fails fast instead of queuing all traffic behind it.
- Estimated duration and replica-lag impact, noted in the PR.

## 5. Verify
- Test the migration on a prod-scale copy (or at least a representative sample) — timing on an empty dev DB lies by orders of magnitude.
- After deploy: check for long-running transactions blocking DDL (`pg_stat_activity`), replica lag, and the app's error rate for 2 dashboards' worth of time.
- The contract-phase deploy gets the same attention as the expand — cleaning up is where outages hide.

## Pitfalls
- Migration + code in one deploy: the migration runs before the new code is up (or the code is up before the migration) — orderings differ per deploy system, so make both compatible either way.
- Long transactions holding locks while a migration waits behind them: kill the app-side pattern too (keep transactions short around DDL).
- Backfilling in one statement on a big table: it will lock, choke replication, and time out. Batches, always.
