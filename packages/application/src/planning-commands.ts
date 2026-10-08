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
import {
  assertPlayerShowPlanningActionAllowed,
  playerShowPlanningStatus,
} from "./planning-status.js";
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

function samePpwDate(
  left: { year: number; week: number; day: number },
  right: { year: number; week: number; day: number },
): boolean {
  return left.year === right.year && left.week === right.week && left.day === right.day;
}

function sameIdSet(left: readonly Id[], right: readonly Id[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return new Set(left).size === left.length && left.every((id) => rightSet.has(id));
}

function assertMaterializedCardOnlyEdit(
  state: WorldState,
  existing: DetailedShowDraft,
  next: DetailedShowDraft,
  eventId: Id | null,
): void {
  if (!eventId) throw new Error("materialized show card edit is missing its committed event");
  if (
    next.draftId !== existing.draftId
    || next.promotionId !== existing.promotionId
    || !samePpwDate(next.targetDate, existing.targetDate)
    || next.marketId !== existing.marketId
    || next.venueId !== existing.venueId
    || next.ticketStrategy !== existing.ticketStrategy
  ) {
    throw new Error("materialized show logistics cannot be edited after the show is committed");
  }

  const event = state.events.find((candidate) => candidate.id === eventId);
  if (!event || event.status !== "SCHEDULED" || event.promotionId !== existing.promotionId) {
    throw new Error("materialized show card can only be edited while its event is scheduled");
  }
  const committedIds = state.scheduledAppearances
    .filter((appearance) => appearance.eventId === event.id && appearance.status === "COMMITTED")
    .map((appearance) => appearance.personId);
  if (!sameIdSet(next.participantIds, committedIds)) {
    throw new Error("materialized show card must keep the wrestlers already committed to the event");
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
    const existing = planning.workspaces
      .find((workspace) => workspace.promotionId === envelope.payload.promotionId)
      ?.detailedShowDrafts.find((draft) => draft.draftId === envelope.payload.draft.draftId);
    if (existing) {
      const status = playerShowPlanningStatus(
        state,
        planning,
        runtime,
        envelope.payload.promotionId,
        existing.draftId,
      );
      if (status.availableActions.includes("EDIT_DRAFT")) {
        assertPlayerShowPlanningActionAllowed(status, "EDIT_DRAFT");
      } else {
        assertPlayerShowPlanningActionAllowed(status, "EDIT_CARD");
        assertMaterializedCardOnlyEdit(state, existing, envelope.payload.draft, status.eventId);
      }
    }
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
    const status = playerShowPlanningStatus(
      state,
      planning,
      runtime,
      envelope.payload.promotionId,
      envelope.payload.draftId,
    );
    assertPlayerShowPlanningActionAllowed(status, "DELETE_DRAFT");
    return removeDetailedShowDraft(
      planning,
      envelope.payload.promotionId,
      envelope.payload.expectedPlanVersion,
      envelope.payload.draftId,
    );
  });
}
