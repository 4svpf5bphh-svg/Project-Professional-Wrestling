# ALPHA-1A Gate D — Scheduled World Resolution

Status: **validation candidate**

This slice completes the missing server-owned weekly clock path without changing deterministic wrestling rules.

## Production clock

- Vercel invokes `/api/internal/resolve-week` once per day at **08:00 UTC**.
- The route is protected by `CRON_SECRET` and is not a player command.
- The adapter supplies a UTC `YYYY-MM-DD` cycle key to the application scheduler.
- The application scheduler, not Vercel-specific code, owns retry/recovery semantics.
- The old `/api/advance-week` endpoint is retained only as an explicit test/admin harness behind `PPW_ENABLE_MANUAL_WEEK_ADVANCE=1`; Production does not opt in.

## Once-only resolution

`WorldRuntimeState` now persists:

- `lockedRealCycleKey` for the cycle currently held by a durable `LOCKING` checkpoint;
- `lastResolvedRealCycleKey` for the most recent completed scheduled cycle.

A duplicate or stale cron delivery cannot resolve another PPW week. The scheduler treats a cycle at or before `lastResolvedRealCycleKey` as already resolved.

If a scheduled call finds a legacy or older durable lock, it claims that lock for the current cycle and resolves exactly one PPW week. This deliberately consumes the current cycle so an immediate retry cannot recover the old lock and then advance a second week.

A stale scheduled call also cannot interfere with a durable lock already tagged for a newer real cycle.

The cycle key is operational metadata only. It never enters deterministic match, contract, finance or career calculations.

## Crash recovery

The existing durable transaction split remains authoritative:

1. current-week reservations are revalidated/materialized;
2. `OPEN -> LOCKING` commits with the PPW date and real-cycle key;
3. `LOCKING -> RESOLVING -> resolveWorldWeek() -> OPEN` runs atomically.

If execution dies after the lock commit, the next scheduler delivery sees the persisted lock and resumes the same locked PPW week. If the resolution transaction dies, PostgreSQL rollback preserves the durable `LOCKING` checkpoint.

The persisted World snapshot at the `LOCKING` boundary remains the Alpha recovery checkpoint; Gate D does not create a second competing snapshot mechanism around the same transaction.

## Numbered PostgreSQL migrations

Gate D establishes an explicit application-database migration ledger in `ppw_schema_migrations`.

Current versions are:

1. application World repository baseline;
2. editable planning state;
3. scheduled resolution cycle keys.

Migration execution is serialized inside a PostgreSQL transaction. Existing Alpha databases safely walk the idempotent historical steps and record them; fresh databases reach the same schema from an empty database. Future schema work now has a stable numbered boundary instead of depending only on repeated `ALTER ... IF NOT EXISTS` calls.

## Validation contract

The scheduler test suite must prove:

- a fresh cycle resolves exactly one PPW week;
- duplicate delivery is a no-op;
- a later cycle resolves the next week;
- a persisted same-cycle lock is recovered exactly once;
- legacy/older locks recover one week and consume the current real cycle;
- an older scheduled delivery is harmless;
- an older scheduled delivery cannot disturb a newer durable lock;
- malformed cycle keys are rejected.

PostgreSQL integration must additionally prove that the numbered migration ledger is complete and idempotent.

The normal full functional suite, production Next build, live HTTP/PostgreSQL integration and unchanged deterministic 10-year/100-year hashes remain release gates.
