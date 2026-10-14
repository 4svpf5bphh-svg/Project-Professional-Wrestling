import type { Id, WorldState } from "../../domain/src/types.js";
import {
  createPersistedWorldState,
  restorePersistedWorldState,
  type PersistedWorldState,
} from "../../sim-core/src/state-schema.js";
import type { WorldCommandState } from "./commands.js";
import {
  createWorldEngagementState,
  normalizeWorldEngagementState,
  type WorldEngagementState,
} from "./engagement.js";
import type { WorldOwnershipState } from "./ownership.js";
import {
  createWorldPlanningState,
  normalizeWorldPlanningState,
  validateWorldPlanningStateShape,
  type WorldPlanningState,
} from "./planning.js";
import type { WorldRuntimeState } from "./runtime.js";

export const CURRENT_APPLICATION_STATE_SCHEMA_VERSION = 2 as const;

export interface ApplicationWorldAggregate {
  state: WorldState;
  ownership: WorldOwnershipState;
  commands: WorldCommandState;
  runtime: WorldRuntimeState;
  planning: WorldPlanningState;
  engagement?: WorldEngagementState;
}

export interface PersistedApplicationWorld {
  applicationStateSchemaVersion: typeof CURRENT_APPLICATION_STATE_SCHEMA_VERSION;
  world: PersistedWorldState;
  ownership: WorldOwnershipState;
  commands: WorldCommandState;
  runtime: WorldRuntimeState;
  planning: WorldPlanningState;
  engagement: WorldEngagementState;
}

interface PersistedApplicationWorldV1 {
  applicationStateSchemaVersion: 1;
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
  /**
   * Read-only Talent/Staff projection: may omit historical ledger and financial
   * transactions. Never use the result for simulation or persistence writes.
   */
  loadTalentView?(worldId: Id): Promise<ApplicationWorldAggregate>;
  transact<TResult>(
    worldId: Id,
    expectedRevision: number | null,
    action: (aggregate: ApplicationWorldAggregate) => TResult | Promise<TResult>,
    /** Undefined = legacy full history; [] = none; IDs = exact retry receipts. */
    receiptRequestIds?: readonly string[],
  ): Promise<WorldTransactionResult<TResult>>;
}

/** Explicit opt-in for simulation and non-idempotency mutations.
 * They must never need historical command receipts to execute.
 */
export function transactWithoutReceiptHistory<TResult>(
  repository: ApplicationWorldRepository,
  worldId: Id,
  expectedRevision: number | null,
  action: (aggregate: ApplicationWorldAggregate) => TResult | Promise<TResult>,
): Promise<WorldTransactionResult<TResult>> {
  return repository.transact(worldId, expectedRevision, action, []);
}

function ensureEngagement(aggregate: ApplicationWorldAggregate): WorldEngagementState {
  const worldId = aggregate.state.world.id;
  aggregate.engagement = normalizeWorldEngagementState(aggregate.engagement, worldId);
  return aggregate.engagement;
}

function validateAggregateWorlds(aggregate: ApplicationWorldAggregate): void {
  const worldId = aggregate.state.world.id;
  if (aggregate.ownership.worldId !== worldId) throw new Error("ownership state crosses World boundary");
  if (aggregate.commands.worldId !== worldId) throw new Error("command state crosses World boundary");
  if (aggregate.runtime.worldId !== worldId) throw new Error("runtime state crosses World boundary");
  if (aggregate.planning.worldId !== worldId) throw new Error("planning state crosses World boundary");
  if (ensureEngagement(aggregate).worldId !== worldId) throw new Error("engagement state crosses World boundary");
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
  aggregate.planning = normalizeWorldPlanningState(aggregate.planning);
  const engagement = ensureEngagement(aggregate);
  validateAggregateWorlds(aggregate);
  return structuredClone({
    applicationStateSchemaVersion: CURRENT_APPLICATION_STATE_SCHEMA_VERSION,
    world: createPersistedWorldState(aggregate.state),
    ownership: aggregate.ownership,
    commands: aggregate.commands,
    runtime: aggregate.runtime,
    planning: aggregate.planning,
    engagement,
  });
}

function normalizePersistedApplicationWorld(
  snapshot: PersistedApplicationWorld | PersistedApplicationWorldV1 | LegacyPersistedApplicationWorld,
): PersistedApplicationWorld {
  if ("applicationStateSchemaVersion" in snapshot) {
    if (snapshot.applicationStateSchemaVersion === CURRENT_APPLICATION_STATE_SCHEMA_VERSION) {
      const normalized = structuredClone(snapshot);
      normalized.planning = normalizeWorldPlanningState(normalized.planning);
      normalized.engagement = normalizeWorldEngagementState(normalized.engagement, normalized.world.world.id);
      return normalized;
    }
    if (snapshot.applicationStateSchemaVersion === 1) {
      return {
        applicationStateSchemaVersion: CURRENT_APPLICATION_STATE_SCHEMA_VERSION,
        world: structuredClone(snapshot.world),
        ownership: structuredClone(snapshot.ownership),
        commands: structuredClone(snapshot.commands),
        runtime: structuredClone(snapshot.runtime),
        planning: normalizeWorldPlanningState(snapshot.planning),
        engagement: createWorldEngagementState(snapshot.world.world.id),
      };
    }
    throw new Error(`unsupported application state schema version: ${String((snapshot as { applicationStateSchemaVersion: unknown }).applicationStateSchemaVersion)}`);
  }

  return {
    applicationStateSchemaVersion: CURRENT_APPLICATION_STATE_SCHEMA_VERSION,
    world: structuredClone(snapshot.world),
    ownership: structuredClone(snapshot.ownership),
    commands: structuredClone(snapshot.commands),
    runtime: structuredClone(snapshot.runtime),
    planning: createWorldPlanningState(snapshot.world.world.id),
    engagement: createWorldEngagementState(snapshot.world.world.id),
  };
}

export function restorePersistedApplicationWorld(
  input: PersistedApplicationWorld | PersistedApplicationWorldV1 | LegacyPersistedApplicationWorld,
): ApplicationWorldAggregate {
  const snapshot = normalizePersistedApplicationWorld(input);
  const aggregate: ApplicationWorldAggregate = {
    state: restorePersistedWorldState(snapshot.world),
    ownership: structuredClone(snapshot.ownership),
    commands: structuredClone(snapshot.commands),
    runtime: structuredClone(snapshot.runtime),
    planning: normalizeWorldPlanningState(snapshot.planning),
    engagement: normalizeWorldEngagementState(snapshot.engagement, snapshot.world.world.id),
  };
  validateAggregateWorlds(aggregate);
  return aggregate;
}

export function cloneApplicationWorld(
  aggregate: ApplicationWorldAggregate,
): ApplicationWorldAggregate {
  return restorePersistedApplicationWorld(createPersistedApplicationWorld(aggregate));
}
