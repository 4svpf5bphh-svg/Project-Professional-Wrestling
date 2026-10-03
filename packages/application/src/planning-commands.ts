import type { Id, WorldState } from "../../domain/src/types.js";
import {
  executeIdempotentCommand,
  type ApplicationCommandEnvelope,
  type WorldCommandState,
} from "./commands.js";
import {
  activeWorldMembership,
  playerControlsPromotion,
  type WorldOwnershipState,
} from "./ownership.js";
import {
  removeDetailedShowDraft,
  upsertDetailedShowDraft,
  type DetailedShowDraft,
  type PromotionPlanningWorkspace,
  type WorldPlanningState,
} from "./planning.js";
import type { WorldRuntimeState } from "./runtime.js";

export interface UpsertDetailedShowDraftPayload {
  promotionId: Id;
  expectedPlanVersion: number;
  draft: DetailedShowDraft;
}

export interface RemoveDetailedShowDraftPayload {
  promotionId: Id;
  expectedPlanVersion: number;
  draftId: string;
}

function authorizePlanningMutation(
  state: WorldState,
  ownership: WorldOwnershipState,
  planning: WorldPlanningState,
  playerId: string,
  promotionId: Id,
): void {
  if (ownership.worldId !== state.world.id || planning.worldId !== state.world.id) {
    throw new Error("planning command application state does not belong to this World");
  }
  if (!activeWorldMembership(ownership, playerId)) {
    throw new Error(`${playerId} is not an active member of ${state.world.id}`);
  }
  if (!playerControlsPromotion(ownership, playerId, promotionId)) {
    throw new Error(`${playerId} does not control ${promotionId}`);
  }
}

export function upsertDetailedShowDraftCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  planning: WorldPlanningState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<UpsertDetailedShowDraftPayload>,
): PromotionPlanningWorkspace {
  if (envelope.commandType !== "UPSERT_DETAILED_SHOW_DRAFT") {
    throw new Error(`expected UPSERT_DETAILED_SHOW_DRAFT command, received ${envelope.commandType}`);
  }

  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    authorizePlanningMutation(state, ownership, planning, envelope.playerId, envelope.payload.promotionId);
    return upsertDetailedShowDraft(
      state,
      planning,
      envelope.payload.promotionId,
      envelope.payload.expectedPlanVersion,
      envelope.payload.draft,
    );
  });
}

export function removeDetailedShowDraftCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  planning: WorldPlanningState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<RemoveDetailedShowDraftPayload>,
): PromotionPlanningWorkspace {
  if (envelope.commandType !== "REMOVE_DETAILED_SHOW_DRAFT") {
    throw new Error(`expected REMOVE_DETAILED_SHOW_DRAFT command, received ${envelope.commandType}`);
  }

  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    authorizePlanningMutation(state, ownership, planning, envelope.playerId, envelope.payload.promotionId);
    return removeDetailedShowDraft(
      planning,
      envelope.payload.promotionId,
      envelope.payload.expectedPlanVersion,
      envelope.payload.draftId,
    );
  });
}
