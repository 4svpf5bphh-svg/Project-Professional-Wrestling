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
  releaseDetailedShowReservation,
  reserveDetailedShowDraft,
} from "./planning-reservations.js";
import type { DetailedShowReservation, WorldPlanningState } from "./planning.js";
import type { WorldRuntimeState } from "./runtime.js";

export interface ReserveDetailedShowDraftPayload {
  promotionId: Id;
  expectedPlanVersion: number;
  draftId: string;
}

export interface ReleaseDetailedShowReservationPayload {
  promotionId: Id;
  draftId: string;
}

function authorizeReservationMutation(
  state: WorldState,
  ownership: WorldOwnershipState,
  planning: WorldPlanningState,
  playerId: string,
  promotionId: Id,
): void {
  if (ownership.worldId !== state.world.id || planning.worldId !== state.world.id) {
    throw new Error("reservation command application state does not belong to this World");
  }
  if (!activeWorldMembership(ownership, playerId)) {
    throw new Error(`${playerId} is not an active member of ${state.world.id}`);
  }
  if (!playerControlsPromotion(ownership, playerId, promotionId)) {
    throw new Error(`${playerId} does not control ${promotionId}`);
  }
}

export function reserveDetailedShowDraftCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  planning: WorldPlanningState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<ReserveDetailedShowDraftPayload>,
): DetailedShowReservation {
  if (envelope.commandType !== "RESERVE_DETAILED_SHOW_DRAFT") {
    throw new Error(`expected RESERVE_DETAILED_SHOW_DRAFT command, received ${envelope.commandType}`);
  }
  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    authorizeReservationMutation(state, ownership, planning, envelope.playerId, envelope.payload.promotionId);
    return reserveDetailedShowDraft(
      state,
      planning,
      envelope.payload.promotionId,
      envelope.payload.expectedPlanVersion,
      envelope.payload.draftId,
    );
  });
}

export function releaseDetailedShowReservationCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  planning: WorldPlanningState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<ReleaseDetailedShowReservationPayload>,
): DetailedShowReservation {
  if (envelope.commandType !== "RELEASE_DETAILED_SHOW_RESERVATION") {
    throw new Error(`expected RELEASE_DETAILED_SHOW_RESERVATION command, received ${envelope.commandType}`);
  }
  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    authorizeReservationMutation(state, ownership, planning, envelope.playerId, envelope.payload.promotionId);
    return releaseDetailedShowReservation(
      planning,
      envelope.payload.promotionId,
      envelope.payload.draftId,
    );
  });
}
