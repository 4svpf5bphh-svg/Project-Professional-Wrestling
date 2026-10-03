# ALPHA-1A Gate B.3 — World Runtime Phase and Revision Locking

Status: **Complete**

This slice introduces the application-level World runtime boundary that will eventually be persisted and driven by the scheduled weekly worker.

## Runtime state

`WorldRuntimeState` remains outside deterministic wrestling `WorldState` and records:

- World ID;
- runtime phase: `OPEN | LOCKING | RESOLVING`;
- committed World revision;
- the PPW date captured when the current weekly lock began;
- the most recently resolved PPW date.

A newly created runtime begins `OPEN` at revision `0`.

## Phase model

The only legal weekly transition is:

`OPEN -> LOCKING -> RESOLVING -> OPEN`

`lockWorldForResolution()` captures the authoritative PPW date and closes the World to new player mutations.

`beginWorldResolution()` requires an existing lock and rejects resolution if the deterministic World date changed after the lock was taken.

`resolveLockedWorldWeek()` can only execute from `RESOLVING`. It invokes the existing authoritative `resolveWorldWeek()` exactly once, records the resolved PPW date, clears the lock, reopens the World and advances the committed World revision once.

There is deliberately no player-facing `ADVANCE_WORLD` application command. Normal shared-World advancement belongs to the scheduler/worker boundary.

## Player command locking

New player mutations may execute only while the runtime is `OPEN`.

Commands in `LOCKING` or `RESOLVING` are rejected before their simulation/application mutation runs and therefore do not:

- create a command receipt;
- mutate World ownership or wrestling state;
- advance the World revision.

An already committed idempotent retry remains readable during a lock. Because it returns its existing command receipt/result without executing the mutation again, a network retry around the weekly deadline does not become a false failure.

## Revision semantics

The runtime `revision` is a committed gameplay/application freshness marker, not a counter of every internal phase assignment.

It advances exactly once after:

- a newly committed player mutation;
- a successfully resolved PPW week.

It does not advance for:

- idempotent retries;
- rejected/failed commands;
- the `OPEN -> LOCKING` phase change;
- the `LOCKING -> RESOLVING` phase change.

Command receipts now record the `committedRevision` associated with their successful mutation.

The eventual relational repository will use additional database transaction/concurrency controls as required; this revision is the application-visible World freshness value.

## World isolation

Runtime state is World-scoped. A runtime created for another World cannot authorize commands or resolve a different World.

## Transaction boundary still deferred

This slice defines runtime semantics in memory. It does not claim crash-safe resolution yet.

If an in-memory resolution process failed after partially mutating `WorldState`, this layer alone cannot roll it back. Gate B.4 must place the runtime phase transition, World mutation, ownership/command state and final revision update inside the appropriate transactional/repository boundary so a failed worker can retry from the same authoritative state.

## Regression contract

Validation requires:

- complete functional suite;
- seven application runtime tests covering initialization, lock rejection, locked idempotent retry, transition ordering, one-week worker resolution, stale-lock rejection and World isolation;
- command tests proving revision increments only on successful first commits;
- standard 10-year hash `6a5dcd3b`;
- standard 100-year hash `7662b626`;
- zero invariant failures.

## Gate B status

Completed:

1. first-class World membership and promotion ownership;
2. configurable human-seat capacity outside sim-core;
3. application command envelope and idempotency semantics;
4. World runtime phase/revision and player-command locking.

Remaining Gate B work:

- transactional/repository persistence of World state, runtime, ownership and command receipts;
- migration of remaining player-facing simulation operations behind the authorized application command boundary.
