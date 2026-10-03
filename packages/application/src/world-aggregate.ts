import type { Id, WorldState } from "../../domain/src/types.js";
import {
  createPersistedWorldState,
  restorePersistedWorldState,
  type PersistedWorldState,
} from "../../sim-core/src/state-schema.js";
import type { WorldCommandState } from "./commands.js";
import type { WorldOwnershipState } from "./ownership.js";
import type { WorldRuntimeState } from "./runtime.js";

export interface ApplicationWorldAggregate {
  state: WorldState;
  ownership: WorldOwnershipState;
  commands: WorldCommandState;
  runtime: WorldRuntimeState;
}

export interface PersistedApplicationWorld {
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
  if (!Number.isSafeInteger(aggregate.runtime.revision) || aggregate.runtime.revision < 0) {
    throw new Error("World runtime revision is invalid");
  }
  for (const receipt of aggregate.commands.receipts) {
    if (receipt.worldId !== worldId) throw new Error("command receipt crosses World boundary");
    if (receipt.committedRevision > aggregate.runtime.revision) {
      throw new Error("command receipt revision exceeds current World revision");
    }
  }
}

export function createPersistedApplicationWorld(
  aggregate: ApplicationWorldAggregate,
): PersistedApplicationWorld {
  validateAggregateWorlds(aggregate);
  return structuredClone({
    world: createPersistedWorldState(aggregate.state),
    ownership: aggregate.ownership,
    commands: aggregate.commands,
    runtime: aggregate.runtime,
  });
}

export function restorePersistedApplicationWorld(
  snapshot: PersistedApplicationWorld,
): ApplicationWorldAggregate {
  const aggregate: ApplicationWorldAggregate = {
    state: restorePersistedWorldState(snapshot.world),
    ownership: structuredClone(snapshot.ownership),
    commands: structuredClone(snapshot.commands),
    runtime: structuredClone(snapshot.runtime),
  };
  validateAggregateWorlds(aggregate);
  return aggregate;
}

export function cloneApplicationWorld(
  aggregate: ApplicationWorldAggregate,
): ApplicationWorldAggregate {
  return restorePersistedApplicationWorld(createPersistedApplicationWorld(aggregate));
}
