import { DEFAULT_RULESET } from "../../config/src/default-ruleset.js";
import {
  activePromotionControlForPlayer,
  buildAlphaPlayerWorldView,
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  lockPersistedWorldForResolution,
  materializePersistedCurrentWeekReservations,
  resolvePersistedWorldWeek,
  type AlphaPlayerWorldView,
  type ApplicationWorldAggregate,
  type ApplicationWorldRepository,
} from "../../application/src/index.js";
import { createWorld } from "../../sim-core/src/genesis.js";

export interface AlphaWorldBootstrapOptions {
  seed: number;
  playerId: string;
  worldName?: string;
}

export interface AlphaClaimRequest {
  promotionId: string;
  requestId: string;
  name?: string;
}

export interface AlphaAdvanceWeekRequest {
  expectedRevision: number;
}

function normalizedSeed(seed: number): number {
  if (!Number.isSafeInteger(seed)) throw new Error("Alpha World seed must be an integer");
  return seed >>> 0;
}

function requireExpectedRevision(revision: number): number {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("expectedRevision must be a non-negative integer");
  }
  return revision;
}

export function alphaWorldId(seed: number): string {
  return `world-${normalizedSeed(seed)}`;
}

export function createAlphaWorldAggregate(options: AlphaWorldBootstrapOptions): ApplicationWorldAggregate {
  const seed = normalizedSeed(options.seed);
  const state = createWorld(seed, DEFAULT_RULESET, options.worldName ?? "PPW Alpha World");
  const ownership = createWorldOwnershipState(state.world.id, 1);
  joinPlayerToWorld(ownership, options.playerId, state.world.currentDate);
  return {
    state,
    ownership,
    commands: createWorldCommandState(state.world.id),
    runtime: createWorldRuntimeState(state.world.id),
    planning: createWorldPlanningState(state.world.id),
  };
}

export async function ensureAlphaWorld(
  repository: ApplicationWorldRepository,
  options: AlphaWorldBootstrapOptions,
): Promise<string> {
  const worldId = alphaWorldId(options.seed);
  try {
    await repository.load(worldId);
    return worldId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("was not found")) throw error;
  }

  try {
    await repository.initialize(createAlphaWorldAggregate(options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("already exists")) throw error;
  }
  return worldId;
}

export async function loadAlphaPlayerSession(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<AlphaPlayerWorldView> {
  return buildAlphaPlayerWorldView(await repository.load(worldId), playerId);
}

export async function claimAlphaPromotion(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaClaimRequest,
): Promise<AlphaPlayerWorldView> {
  await repository.transact(worldId, null, (aggregate) => {
    claimIndependentPromotionCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: request.requestId,
        worldId,
        playerId,
        commandType: "CLAIM_INDEPENDENT_PROMOTION",
        payload: {
          promotionId: request.promotionId,
          options: request.name === undefined ? undefined : { name: request.name },
        },
      },
    );
  });
  return loadAlphaPlayerSession(repository, worldId, playerId);
}

export async function advanceAlphaWorldWeek(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaAdvanceWeekRequest,
): Promise<AlphaPlayerWorldView> {
  const expectedRevision = requireExpectedRevision(request.expectedRevision);
  const before = await repository.load(worldId);
  const control = activePromotionControlForPlayer(before.ownership, playerId);
  if (!control) throw new Error("Alpha player must control a promotion before finishing a PPW week");

  if (before.runtime.phase === "RESOLVING") {
    throw new Error(`World ${worldId} is resolving and cannot accept another Alpha week request`);
  }

  if (before.runtime.phase === "LOCKING") {
    await resolvePersistedWorldWeek(repository, worldId, before.runtime.revision);
    return loadAlphaPlayerSession(repository, worldId, playerId);
  }

  if (before.runtime.revision !== expectedRevision) {
    throw new Error(
      `stale World revision for ${worldId}: expected ${expectedRevision}, current ${before.runtime.revision}`,
    );
  }

  const materialized = await materializePersistedCurrentWeekReservations(
    repository,
    worldId,
    expectedRevision,
  );
  const lockedRevision = await lockPersistedWorldForResolution(
    repository,
    worldId,
    materialized.revision,
  );
  await resolvePersistedWorldWeek(repository, worldId, lockedRevision);
  return loadAlphaPlayerSession(repository, worldId, playerId);
}
