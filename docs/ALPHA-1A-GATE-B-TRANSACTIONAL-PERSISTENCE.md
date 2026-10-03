# ALPHA-1A Gate B.4 — Transactional Repository and PostgreSQL Persistence

Status: **Complete**

This slice turns the in-memory Gate B contracts into a real atomic persistence boundary without changing deterministic wrestling behavior.

## Application aggregate

The authoritative application aggregate now consists of four deliberately separate concerns:

- deterministic simulation `WorldState`;
- `WorldOwnershipState` for memberships and promotion control;
- `WorldCommandState` for idempotency receipts;
- `WorldRuntimeState` for phase, revision and weekly lock state.

`ApplicationWorldRepository` owns loading and transactional mutation of that aggregate. Player/API code should not independently save those pieces.

## Transaction contract

A repository transaction:

1. loads a detached authoritative aggregate;
2. optionally validates the caller's expected World revision;
3. executes the application/simulation mutation against that detached working copy;
4. publishes all affected state only if the action completes successfully.

If the action throws, none of the working-copy mutations are committed.

This is proven with real promotion-control/command mutations: a command can change the simulation promotion, ownership, receipt list and runtime revision and then throw; reload returns the exact pre-transaction state.

## Durable weekly resolution

Weekly resolution is now split across two durable transaction points:

1. `lockPersistedWorldForResolution()` commits `OPEN -> LOCKING` without changing gameplay revision;
2. `resolvePersistedWorldWeek()` runs `LOCKING -> RESOLVING -> resolveWorldWeek() -> OPEN` inside one repository transaction.

If the worker fails during the second transaction, persisted state remains at the previous durable `LOCKING` checkpoint. A retry can therefore resolve from the same authoritative PPW week instead of inheriting a partially mutated in-memory World.

## Optimistic freshness plus database serialization

The application-visible expected revision remains the stale-client check.

The PostgreSQL adapter additionally executes transactions after locking the owning `ppw_worlds` row with `SELECT ... FOR UPDATE`. Competing writers for the same World therefore serialize at the database boundary, and the expected revision is checked after the authoritative row lock is obtained.

This makes revision a useful API freshness mechanism rather than pretending it is a substitute for database concurrency control.

## PostgreSQL layout

Gate B.4 introduces relational application tables:

- `ppw_worlds` — World runtime/revision metadata plus current simulation checkpoint;
- `ppw_world_memberships` — World/player membership records;
- `ppw_promotion_controls` — player/promotion control records;
- `ppw_command_receipts` — durable idempotency receipts.

Database constraints enforce the currently locked multiplayer ownership rules for active records:

- one active World membership per player/World;
- one active promotion per player/World;
- one active human controller per promotion/World;
- unique request IDs per World.

## Simulation checkpoint choice

The simulation state remains a versioned JSONB checkpoint in `ppw_worlds` during this gate.

This is intentional and **not** the final hot/history storage architecture. The simulation already owns an explicit versioned save contract and deterministic restore path; using that as the first transactional database checkpoint lets us make crashes and command retries safe without prematurely normalizing hundreds of simulation fields and historical rows.

The earlier architecture rule still stands: long-lived hot operational state and large append/history collections will be separated in the later persistence/history work. The JSONB checkpoint is not being declared the final century-scale query model.

## Persistence adapter choice

Gate B.4 uses the small `postgres` driver behind `ApplicationWorldRepository` rather than binding application code directly to an ORM.

This is a deliberate safe acceleration while the Alpha schema is still moving. The repository interface isolates this choice. Drizzle or another typed relational adapter can be introduced/replaced later without changing sim-core or player-facing command semantics if it materially improves migrations/query maintenance.

## In-memory reference adapter

`InMemoryApplicationWorldRepository` implements the same transactional semantics for fast tests. It persists through the same application/simulation snapshot boundary and publishes only successful transactions.

It is a test/reference adapter, not the hosted multiplayer concurrency mechanism. PostgreSQL is the authoritative hosted target.

## CI integration

GitHub Actions now starts a real PostgreSQL 16 service and runs database integration tests after the functional suite.

The integration tests prove:

- a promotion claim atomically persists simulation state, ownership, command receipt and revision;
- an idempotent retry survives database reload without duplicating ownership or receipts or advancing revision;
- a forced transaction failure leaves no partial World/application mutation;
- the weekly `LOCKING` checkpoint is durable;
- weekly resolution commits atomically and reopens the World.

## Migration boundary

The SQL schema is currently created idempotently by the repository migration entry point for Alpha testing. Formal numbered production migrations remain part of the deployment/persistence hardening work before a public/long-lived hosted World is treated as production data.

Simulation `stateSchemaVersion` remains separate from database/application migration versioning.

## Regression contract

Validation requires:

- complete functional suite;
- five application repository transaction tests;
- three live PostgreSQL 16 integration tests;
- standard 10-year hash `6a5dcd3b`;
- standard 100-year hash `7662b626`;
- zero simulation invariant failures.

## Gate B status

Completed:

1. World membership and promotion ownership;
2. configurable human-seat capacity outside sim-core;
3. command envelope and durable idempotency semantics;
4. World runtime phase/revision and player-command locking;
5. transactional repository boundary and PostgreSQL persistence.

Remaining before Gate B can be considered fully player-facing:

- migrate the remaining human show/card/championship/lifecycle operations behind authorized application command wrappers as the relevant planning model is introduced;
- session/authentication integration belongs with the eventual API layer rather than sim-core.

The next architectural milestone is Gate C: editable advance planning and scheduling. The PWA should still wait until that planning contract is stable.
