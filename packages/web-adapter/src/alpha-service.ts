import { DEFAULT_RULESET } from "../../config/src/default-ruleset.js";
import {
  buildAlphaPlayerWorldView,
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
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

function normalizedSeed(seed: number): number {
  if (!Number.isSafeInteger(seed)) throw new Error("Alpha World seed must be an integer");
  return seed >>> 0;
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
