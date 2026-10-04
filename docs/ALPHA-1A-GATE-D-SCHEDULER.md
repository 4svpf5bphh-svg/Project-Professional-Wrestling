# ALPHA-1A Gate D — Scheduled World Resolution

Status: **validation candidate**

This slice completes the missing server-owned weekly clock path without changing deterministic wrestling rules.

## Production clock

- Vercel invokes `/api/internal/resolve-week` once per day at **08:00 UTC**.
- The route is protected by `CRON_SECRET` and is not a player command.
- The adapter supplies a UTC `YYYY-MM-DD` cycle key to the application scheduler.
- The application scheduler, not Vercel-specific code, owns retry/recovery semantics.

## Once-only resolution

`WorldRuntimeState` now persists:

- `lockedRealCycleKey` for the cycle currently held by a durable `LOCKING` checkpoint;
- `lastResolvedRealCycleKey` for the most recent completed scheduled cycle.

A duplicate or stale cron delivery cannot resolve another PPW week. The scheduler treats a cycle at or before `lastResolvedRealCycleKey` as already resolved.

The cycle key is operational metadata only. It never enters deterministic match, contract, finance or career calculations.

## Crash recovery

The existing durable transaction split remains authoritative:

1. current-week reservations are revalidated/materialized;
2. `OPEN -> LOCKING` commits with the PPW date and real-cycle key;
3. `LOCKING -> RESOLVING -> resolveWorldWeek() -> OPEN` runs atomically.

If execution dies after the lock commit, the next scheduler delivery sees the persisted lock and resumes the same locked PPW week. If the resolution transaction dies, PostgreSQL rollback preserves the durable `LOCKING` checkpoint.

## Persistence migration

The existing idempotent Alpha migration adds nullable `locked_real_cycle_key` and `last_resolved_real_cycle_key` columns. Existing hosted Worlds therefore migrate without a reset and continue with null scheduler metadata until their first scheduled lock/resolution.

## Validation contract

The scheduler test suite must prove:

- a fresh cycle resolves exactly one PPW week;
- duplicate delivery is a no-op;
- a later cycle resolves the next week;
- a persisted lock for the same cycle is recovered exactly once;
- an older/stale cycle is harmless;
- malformed cycle keys are rejected.

The normal full functional suite, production Next build, live HTTP/PostgreSQL integration and deterministic long-run hashes remain release gates.
