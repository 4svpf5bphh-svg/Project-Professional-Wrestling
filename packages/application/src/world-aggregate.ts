import type { Id, WorldState } from "../../domain/src/types.js";
import {
  createPersistedWorldState,
  restorePersistedWorldState,
  type PersistedWorldState,
} from "../../sim-core/src/state-schema.js";
import type { WorldCommandState } from "./commands.js";
import type { WorldOwnershipState } from "./ownership.js";
import {
  createWorldPlanningState,
  validateWorldPlanningStateShape,
  type WorldPlanningState,
} from "./planning.js";
import type { WorldRuntimeState } from "./runtime.js";

export const CURRENT_APPLICATION_STATE_SCHEMA_VERSION = 1 as const;

export interface ApplicationWorldAggregate {
  state: WorldState;
  ownership: WorldOwnershipState;
  commands: WorldCommandState;
  runtime: WorldRuntimeState;
  planning: WorldPlanningState;
}

export interface PersistedApplicationWorld {
  applicationStateSchemaVersion: typeof CURRENT_APPLICATION_STATE_SCHEMA_VERSION;
  world: PersistedWorldState;
  ownership: WorldOwnershipState;
  commands: WorldCommandState;
  runtime: WorldRuntimeState;
  planning: WorldPlanningState;
}

interface LegacyPersistedApplicationWorld {
  world: PersistedWorldState;
  ownership: WorldOwnershipState;
  commands: WorldCommandState;
  runtime: WorldRuntimeState;
}

export interface WorldTransactionResult<TResult> {
  result: TResult;
  revision: number;
}

export interface ApplicationWorldRepository {
  initialize(aggregate: ApplicationWorldAggregate): Promise<void>;
  load(worldId: Id): Promise<ApplicationWorldAggregate>;
  transact<TResult>(
    worldId: Id,
    expectedRevision: number | null,
    action: (aggregate: ApplicationWorldAggregate) => TResult | Promise<TResult>,
  ): Promise<WorldTransactionResult<TResult>>;
}

function validateAggregateWorlds(aggregate: ApplicationWorldAggregate): void {
  const worldId = aggregate.state.world.id;
  if (aggregate.ownership.worldId !== worldId) throw new Error("ownership state crosses World boundary");
  if (aggregate.commands.worldId !== worldId) throw new Error("command state crosses World boundary");
  if (aggregate.runtime.worldId !== worldId) throw new Error("runtime state crosses World boundary");
  if (aggregate.planning.worldId !== worldId) throw new Error("planning state crosses World boundary");
  if (!Number.isSafeInteger(aggregate.runtime.revision) || aggregate.runtime.revision < 0) {
    throw new Error("World runtime revision is invalid");
  }
  for (const receipt of aggregate.commands.receipts) {
    if (receipt.worldId !== worldId) throw new Error("command receipt crosses World boundary");
    if (receipt.committedRevision > aggregate.runtime.revision) {
      throw new Error("command receipt revision exceeds current World revision");
    }
  }
  validateWorldPlanningStateShape(aggregate.state, aggregate.planning);
}

export function createPersistedApplicationWorld(
  aggregate: ApplicationWorldAggregate,
): PersistedApplicationWorld {
  validateAggregateWorlds(aggregate);
  return structuredClone({
    applicationStateSchemaVersion: CURRENT_APPLICATION_STATE_SCHEMA_VERSION,
    world: createPersistedWorldState(aggregate.state),
    ownership: aggregate.ownership,
    commands: aggregate.commands,
    runtime: aggregate.runtime,
    planning: aggregate.planning,
  });
}

function normalizePersistedApplicationWorld(
  snapshot: PersistedApplicationWorld | LegacyPersistedApplicationWorld,
): PersistedApplicationWorld {
  if ("applicationStateSchemaVersion" in snapshot) {
    if (snapshot.applicationStateSchemaVersion !== CURRENT_APPLICATION_STATE_SCHEMA_VERSION) {
      throw new Error(`unsupported application state schema version: ${String(snapshot.applicationStateSchemaVersion)}`);
    }
    return structuredClone(snapshot);
  }

  return {
    applicationStateSchemaVersion: CURRENT_APPLICATION_STATE_SCHEMA_VERSION,
    world: structuredClone(snapshot.world),
    ownership: structuredClone(snapshot.ownership),
    commands: structuredClone(snapshot.commands),
    runtime: structuredClone(snapshot.runtime),
    planning: createWorldPlanningState(snapshot.world.world.id),
  };
}

export function restorePersistedApplicationWorld(
  input: PersistedApplicationWorld | LegacyPersistedApplicationWorld,
): ApplicationWorldAggregate {
  const snapshot = normalizePersistedApplicationWorld(input);
  const aggregate: ApplicationWorldAggregate = {
    state: restorePersistedWorldState(snapshot.world),
    ownership: structuredClone(snapshot.ownership),
    commands: structuredClone(snapshot.commands),
    runtime: structuredClone(snapshot.runtime),
    planning: structuredClone(snapshot.planning),
  };
  validateAggregateWorlds(aggregate);
  return aggregate;
}

export function cloneApplicationWorld(
  aggregate: ApplicationWorldAggregate,
): ApplicationWorldAggregate {
  return restorePersistedApplicationWorld(createPersistedApplicationWorld(aggregate));
}
