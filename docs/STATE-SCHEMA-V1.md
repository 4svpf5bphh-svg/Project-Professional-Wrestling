# PPW World State Schema v1

`stateSchemaVersion` is the version of PPW's persisted simulation-state shape. It is deliberately separate from `World.rulesetVersion`, which identifies gameplay/simulation rules.

Schema v1 is defined by `PersistedWorldStateV1` in `packages/sim-core/src/state-schema.ts`.

## Contract

- Every persisted simulation collection is present as an array, including collections that may still be lazily initialized in the live in-memory `WorldState`.
- Creating a snapshot does not mutate the live World.
- Restoring a snapshot returns detached runtime state.
- Unsupported schema versions are rejected rather than guessed at.
- The persisted World's `rulesetVersion` must agree with the embedded ruleset version.
- Persistence metadata is outside the deterministic `World` object and does not alter wrestling outcomes or release hashes.

## Migration rule

When the persisted shape changes, increment `stateSchemaVersion` and add an explicit migration from the previous supported schema. Do not overload the simulation ruleset version for storage migrations, and do not rely on `undefined` fields as the permanent migration mechanism.

The current schema boundary is a snapshot contract, not yet the production database. PostgreSQL/Drizzle persistence will map to this versioned state contract during Gate D of ALPHA-1A.
