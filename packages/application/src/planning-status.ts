import type { Id, PpwDate, WorldState } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { humanWeekReadiness } from "../../sim-core/src/human-routine.js";
import {
  reservationAssessmentForDraft,
  type ReservationAssessment,
  type ReservationRiskReason,
} from "./planning-materialization.js";
import {
  reservationForDraft,
} from "./planning-reservations.js";
import type {
  DetailedShowDraft,
  PromotionPlanningWorkspace,
  WorldPlanningState,
} from "./planning.js";
import type { WorldRuntimeState } from "./runtime.js";

export type PlayerShowPlanningState =
  | "DRAFT"
  | "RESERVED"
  | "AT_RISK"
  | "MATERIALIZED"
  | "READY_TO_LOCK"
  | "STAFF_OWNED";

export type PlayerShowPlanningAction =
  | "EDIT_DRAFT"
  | "DELETE_DRAFT"
  | "RESERVE"
  | "REFRESH_RESERVATION"
  | "RELEASE_RESERVATION";

export type PlayerShowReadiness =
  | "FUTURE"
  | "RESERVATION_DUE"
  | "SHOW_REQUIRED"
  | "CARD_REQUIRED"
  | "READY_TO_LOCK"
  | "NOT_REQUIRED"
  | "STAFF_OWNED"
  | "PAST";

export interface PlayerShowPlanningStatus {
  promotionId: Id;
  draftId: string;
  targetDate: PpwDate;
  state: PlayerShowPlanningState;
  readiness: PlayerShowReadiness;
  eventId: Id | null;
  reservationId: string | null;
  reservationAssessment: ReservationAssessment | null;
  riskReasons: ReservationRiskReason[];
  workspaceVersion: number;
  reservedPlanVersion: number | null;
  workspaceChangedSinceReservation: boolean;
  worldPhase: WorldRuntimeState["phase"];
  availableActions: PlayerShowPlanningAction[];
}

function samePpwWeek(a: PpwDate, b: PpwDate): boolean {
  return a.year === b.year && a.week === b.week;
}

function requireWorkspaceAndDraft(
  planning: WorldPlanningState,
  promotionId: Id,
  draftId: string,
): { workspace: PromotionPlanningWorkspace; draft: DetailedShowDraft } {
  const workspace = planning.workspaces.find((candidate) => candidate.promotionId === promotionId);
  if (!workspace) throw new Error(`promotion ${promotionId} has no planning workspace`);
  const draft = workspace.detailedShowDrafts.find((candidate) => candidate.draftId === draftId);
  if (!draft) throw new Error(`show draft ${draftId} was not found`);
  return { workspace, draft };
}

function materializedEventIdForDraft(
  state: WorldState,
  promotionId: Id,
  draftId: string,
): Id | null {
  for (let index = state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = state.ledger[index]!;
    if (entry.type !== "PLANNED_SHOW_MATERIALIZED") continue;
    if (!entry.entityIds.includes(promotionId)) continue;
    if (String(entry.payload.sourceDraftId ?? "") !== draftId) continue;
    const eventId = entry.entityIds.find((entityId) => state.events.some((event) => event.id === entityId));
    if (eventId) return eventId;
  }
  return null;
}

function targetRelation(state: WorldState, targetDate: PpwDate): "PAST" | "CURRENT" | "FUTURE" {
  const current = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const target = ppwDateToWeekIndex(targetDate, state.ruleset.weeksPerYear);
  if (target < current) return "PAST";
  if (target > current) return "FUTURE";
  return "CURRENT";
}

function planningActions(
  phase: WorldRuntimeState["phase"],
  state: PlayerShowPlanningState,
  relation: "PAST" | "CURRENT" | "FUTURE",
): PlayerShowPlanningAction[] {
  if (phase !== "OPEN" || relation === "PAST") return [];
  if (state === "DRAFT") return ["EDIT_DRAFT", "DELETE_DRAFT", "RESERVE"];
  if (state === "RESERVED" || state === "AT_RISK") {
    return ["EDIT_DRAFT", "REFRESH_RESERVATION", "RELEASE_RESERVATION"];
  }
  return [];
}

function currentWeekReadiness(state: WorldState, promotionId: Id): PlayerShowReadiness {
  const promotion = state.promotions.find((candidate) => candidate.id === promotionId);
  if (!promotion || promotion.controllerType !== "HUMAN") return "NOT_REQUIRED";
  const readiness = humanWeekReadiness(state, promotionId);
  if (readiness.status === "READY") return "READY_TO_LOCK";
  if (readiness.status === "CARD_REQUIRED") return "CARD_REQUIRED";
  if (readiness.status === "SHOW_REQUIRED") return "SHOW_REQUIRED";
  return "NOT_REQUIRED";
}

function lockedTargetMatches(runtime: WorldRuntimeState, targetDate: PpwDate): boolean {
  return runtime.phase !== "OPEN"
    && runtime.lockedPpwDate !== null
    && samePpwWeek(runtime.lockedPpwDate, targetDate);
}

export function playerShowPlanningStatus(
  state: WorldState,
  planning: WorldPlanningState,
  runtime: WorldRuntimeState,
  promotionId: Id,
  draftId: string,
): PlayerShowPlanningStatus {
  if (planning.worldId !== state.world.id || runtime.worldId !== state.world.id) {
    throw new Error("planning status application state does not belong to this World");
  }
  const { workspace, draft } = requireWorkspaceAndDraft(planning, promotionId, draftId);
  const relation = targetRelation(state, draft.targetDate);
  const reservation = reservationForDraft(planning, promotionId, draftId);
  const assessment = reservation
    ? reservationAssessmentForDraft(state, planning, promotionId, draftId)
    : null;
  const eventId = materializedEventIdForDraft(state, promotionId, draftId);

  let planningState: PlayerShowPlanningState;
  let readiness: PlayerShowReadiness;

  if (reservation) {
    planningState = assessment?.status === "AT_RISK" ? "AT_RISK" : "RESERVED";
    if (relation === "FUTURE") readiness = "FUTURE";
    else if (relation === "PAST") readiness = "PAST";
    else readiness = assessment?.status === "AT_RISK" ? "SHOW_REQUIRED" : "RESERVATION_DUE";
  } else if (eventId) {
    const weekReadiness = relation === "CURRENT" ? currentWeekReadiness(state, promotionId) : null;
    if (weekReadiness === "READY_TO_LOCK") {
      planningState = "READY_TO_LOCK";
      readiness = "READY_TO_LOCK";
    } else {
      planningState = "MATERIALIZED";
      readiness = weekReadiness ?? (relation === "FUTURE" ? "FUTURE" : relation === "PAST" ? "PAST" : "CARD_REQUIRED");
    }
  } else if (lockedTargetMatches(runtime, draft.targetDate)) {
    planningState = "STAFF_OWNED";
    readiness = "STAFF_OWNED";
  } else {
    planningState = "DRAFT";
    readiness = relation === "FUTURE"
      ? "FUTURE"
      : relation === "PAST"
        ? "PAST"
        : currentWeekReadiness(state, promotionId);
  }

  const reservedPlanVersion = reservation?.reservedPlanVersion ?? null;
  return {
    promotionId,
    draftId,
    targetDate: { ...draft.targetDate },
    state: planningState,
    readiness,
    eventId,
    reservationId: reservation?.reservationId ?? null,
    reservationAssessment: assessment,
    riskReasons: assessment?.reasons ?? [],
    workspaceVersion: workspace.version,
    reservedPlanVersion,
    workspaceChangedSinceReservation: reservedPlanVersion !== null && workspace.version !== reservedPlanVersion,
    worldPhase: runtime.phase,
    availableActions: planningActions(runtime.phase, planningState, relation),
  };
}

export function assertPlayerShowPlanningActionAllowed(
  status: PlayerShowPlanningStatus,
  action: PlayerShowPlanningAction,
): void {
  if (!status.availableActions.includes(action)) {
    throw new Error(`${action} is not allowed while show plan ${status.draftId} is ${status.state}`);
  }
}
