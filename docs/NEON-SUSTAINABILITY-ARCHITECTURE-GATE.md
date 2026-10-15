# PPW database sustainability — architecture gate

Status: BLOCKING PRIORITY. Isolated from production. Do not deploy or merge without evidence.

## Verified facts
- Production World JSONB ~776,093 bytes; gzip snapshot ~555,791 bytes (2026-10-15).
- GET routes such as /api/session, /api/talent, /api/results-overview call withAlphaServerContext.
- withAlphaServerContext defaults to recordPlayerActivity, a SELECT ... FOR UPDATE and UPDATE of engagement_state for each request.
- PostgresServerWorldRepository.load restores the entire World aggregate from world_state, plus memberships and controls, even when a view needs only a subset.
- PR #100 optimized receipt reads. Do not regress idempotency.
- Neon project-wide transfer is not isolated to production and is reported with delay. The observed 45.15 MB -> 73.07 MB is NOT attributable to gameplay alone.

## Invariants
1. Shared server-authoritative World; one wrestler identity; authored match and segment outcomes.
2. Preserve atomic command receipts, World Lock, multiplayer fairness, contract/booking consistency.
3. Do not remove player activity/absence semantics without a verified alternative.
4. No production changes, World reset, or feature deployment before measurement and regression tests.

## Work sequence
1. Inventory every route's reads, writes, and activity-tracking dependency; identify whether a GET changes state, and whether the activity write is actually required.
2. Add route-level query count and transferred-byte instrumentation with sampling; avoid PII and logging World content. Separate player requests, cron, and admin activity.
3. Introduce a narrow read interface for a single high-frequency screen. Use selected SQL columns / projection tables, never load the full aggregate when a view doesn't require it. Verify identical output and access control.
4. Move activity tracking to a deliberately specified, throttled presence/engagement operation only after proving the absence rules remain correct. No unconditional opt-out.
5. Audit scheduled Card Lock / World Lock for redundant snapshots and writes.
6. Compare before/after per-action DB egress and idle baseline on production-equivalent fixture; target <=2.5 GB/month at two players with headroom. Treat extrapolation as provisional until real billing measurements catch up.
7. If targeted improvements cannot meet the target, scope a transactional persistence-layer rebuild while preserving sim-core and app rules.

## First acceptance gate
- Route tests: identical response shape, no unauthorized data, no World mutation from projection reads.
- Concurrency tests: two players and World Lock cannot see inconsistent authoritative state.
- Receipt/idempotency regression tests unchanged.
- Recorded query count, payload bytes, and measured egress for session, roster, results, booking save, advance, and idle.
- A clear decision: optimize in place versus replace persistence layer, supported by measurements.

## Safety
Keep this work on work/neon-cost-architecture until reviewed. Existing draft feature PRs stay held. Avoid repeat CI runs and deployment churn.
