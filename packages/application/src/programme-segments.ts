import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { Id, LedgerEvent, WorldState } from "../../domain/src/types.js";
import type { Programme } from "../../domain/src/programmes.js";
import {
  programmeActivities,
  recordProgrammeActivity,
} from "../../sim-core/src/programmes.js";
import {
  changePromotionWrestlerAlignment,
  isWrestlerAlignment,
} from "../../sim-core/src/alignment.js";
import { LedgerWriter } from "../../sim-core/src/ledger.js";
import type {
  DetailedProgrammeSegmentDraft,
  DetailedShowDraft,
  DetailedShowSegmentDraft,
  DetailedShowSegmentType,
  WorldPlanningState,
} from "./planning.js";

const RESOLVED_SEGMENT_LEDGER_TYPE = "SHOW_SEGMENT_COMPLETED";
const SEGMENT_TYPES = new Set<DetailedShowSegmentType>([
  "PROMO",
  "INTERVIEW",
  "CONFRONTATION",
  "CHALLENGE",
  "ATTACK",
  "CELEBRATION",
  "TURN",
]);

export interface ResolvedShowSegment {
  ledgerId: Id;
  eventId: Id;
  promotionId: Id;
  sourceDraftId: string;
  draftSegmentId: string;
  slotOrder: number;
  type: DetailedShowSegmentType;
  participantIds: Id[];
  programmeId: Id | null;
  plannedLengthMinutes: number;
  turnPersonId: Id | null;
  turnTargetAlignment: WrestlerAlignment | null;
}

interface NormalizedDraftSegment {
  draftSegmentId: string;
  type: DetailedShowSegmentType;
  participantIds: Id[];
  programmeId: Id | null;
  plannedLengthMinutes: number;
  turnPersonId: Id | null;
  turnTargetAlignment: WrestlerAlignment | null;
}

function sameWeek(left: { year: number; week: number }, right: { year: number; week: number }): boolean {
  return left.year === right.year && left.week === right.week;
}

function sameDate(
  left: { year: number; week: number; day: number },
  right: { year: number; week: number; day: number },
): boolean {
  return sameWeek(left, right) && left.day === right.day;
}

function activityEntityIds(
  state: WorldState,
  programme: Programme,
  segment: Pick<DetailedProgrammeSegmentDraft | DetailedShowSegmentDraft, "participantIds">,
): Id[] {
  const selectedPeople = new Set(segment.participantIds);
  const result = new Set<Id>();
  for (const ref of [...programme.sideA, ...programme.sideB]) {
    if (ref.kind === "PERSON") {
      if (selectedPeople.has(ref.entityId)) result.add(ref.entityId);
      continue;
    }
    const hasSelectedMember = (state.teamMemberships ?? []).some((membership) => (
      membership.teamId === ref.entityId
      && membership.active
      && selectedPeople.has(membership.personId)
    ));
    if (hasSelectedMember) result.add(ref.entityId);
  }
  return [...result].sort();
}

function normalizedSegments(draft: DetailedShowDraft): NormalizedDraftSegment[] {
  const typed = (draft.segments ?? []).map((segment) => ({
    draftSegmentId: segment.draftSegmentId,
    type: segment.type,
    participantIds: [...segment.participantIds],
    programmeId: segment.programmeId,
    plannedLengthMinutes: segment.plannedLengthMinutes,
    turnPersonId: segment.type === "TURN" ? (segment.turnPersonId ?? null) : null,
    turnTargetAlignment: segment.type === "TURN" ? (segment.turnTargetAlignment ?? null) : null,
  }));
  const typedIds = new Set(typed.map((segment) => segment.draftSegmentId));
  const legacy = (draft.programmeSegments ?? [])
    .filter((segment) => !typedIds.has(segment.draftSegmentId))
    .map((segment) => ({
      draftSegmentId: segment.draftSegmentId,
      type: "PROMO" as const,
      participantIds: [...segment.participantIds],
      programmeId: segment.programmeId,
      plannedLengthMinutes: 6,
      turnPersonId: null,
      turnTargetAlignment: null,
    }));
  return [...typed, ...legacy];
}

function resolvedSegmentFromLedger(entry: LedgerEvent): ResolvedShowSegment | null {
  if (entry.type !== RESOLVED_SEGMENT_LEDGER_TYPE) return null;
  const eventId = entry.payload.eventId;
  const promotionId = entry.payload.promotionId;
  const sourceDraftId = entry.payload.sourceDraftId;
  const draftSegmentId = entry.payload.draftSegmentId;
  const slotOrder = entry.payload.slotOrder;
  const type = entry.payload.segmentType;
  const participantIds = entry.payload.participantIds;
  const programmeId = entry.payload.programmeId;
  const plannedLengthMinutes = entry.payload.plannedLengthMinutes;
  const turnPersonId = entry.payload.turnPersonId;
  const turnTargetAlignment = entry.payload.turnTargetAlignment;
  if (
    typeof eventId !== "string"
    || typeof promotionId !== "string"
    || typeof sourceDraftId !== "string"
    || typeof draftSegmentId !== "string"
    || typeof slotOrder !== "number"
    || !Number.isInteger(slotOrder)
    || slotOrder < 1
    || typeof type !== "string"
    || !SEGMENT_TYPES.has(type as DetailedShowSegmentType)
    || typeof participantIds !== "string"
    || (programmeId !== null && typeof programmeId !== "string")
    || typeof plannedLengthMinutes !== "number"
    || !Number.isInteger(plannedLengthMinutes)
    || (turnPersonId !== null && typeof turnPersonId !== "string")
    || (turnTargetAlignment !== null && !isWrestlerAlignment(turnTargetAlignment))
  ) return null;

  return {
    ledgerId: entry.id,
    eventId,
    promotionId,
    sourceDraftId,
    draftSegmentId,
    slotOrder,
    type: type as DetailedShowSegmentType,
    participantIds: participantIds ? participantIds.split(",").filter(Boolean) : [],
    programmeId,
    plannedLengthMinutes,
    turnPersonId,
    turnTargetAlignment: turnTargetAlignment as WrestlerAlignment | null,
  };
}

export function resolvedShowSegmentsForEvent(state: WorldState, eventId: Id): ResolvedShowSegment[] {
  return state.ledger
    .map(resolvedSegmentFromLedger)
    .filter((segment): segment is ResolvedShowSegment => segment !== null && segment.eventId === eventId)
    .sort((left, right) => left.slotOrder - right.slotOrder || left.ledgerId.localeCompare(right.ledgerId));
}

function segmentSlotOrder(draft: DetailedShowDraft, segmentId: string, fallbackIndex: number): number {
  const configured = draft.runningOrder?.findIndex((slot) => slot.kind === "SEGMENT" && slot.refId === segmentId) ?? -1;
  if (configured >= 0) return configured + 1;
  return Math.max(draft.runningOrder?.length ?? 0, draft.matches.length) + fallbackIndex + 1;
}

/**
 * Freezes human-booked segments into immutable show history after the event has
 * completed. Programme activity is derived from the same frozen occurrence so
 * Results and Programme Heat cannot disagree about whether a segment happened.
 */
export function recordResolvedShowSegments(
  state: WorldState,
  planning: WorldPlanningState,
): number {
  if (planning.worldId !== state.world.id) throw new Error("planning state does not belong to this World");
  let recorded = 0;
  const writer = new LedgerWriter(state.world.id, state.ledger);

  for (const workspace of planning.workspaces) {
    for (const draft of workspace.detailedShowDrafts) {
      if (!sameWeek(draft.targetDate, state.world.currentDate)) continue;
      const segments = normalizedSegments(draft);
      if (segments.length === 0) continue;
      const event = state.events.find((candidate) => (
        candidate.promotionId === draft.promotionId
        && candidate.status === "COMPLETED"
        && sameDate(candidate.date, draft.targetDate)
      ));
      if (!event) continue;

      const existing = new Set(
        resolvedShowSegmentsForEvent(state, event.id).map((segment) => segment.draftSegmentId),
      );

      segments.forEach((segment, segmentIndex) => {
        if (existing.has(segment.draftSegmentId)) return;
        const slotOrder = segmentSlotOrder(draft, segment.draftSegmentId, segmentIndex);
        writer.append({
          date: event.date,
          type: RESOLVED_SEGMENT_LEDGER_TYPE,
          significance: "ROUTINE",
          entityIds: [event.id, draft.promotionId, ...segment.participantIds],
          payload: {
            eventId: event.id,
            promotionId: draft.promotionId,
            sourceDraftId: draft.draftId,
            draftSegmentId: segment.draftSegmentId,
            slotOrder,
            segmentType: segment.type,
            participantIds: segment.participantIds.join(","),
            programmeId: segment.programmeId,
            plannedLengthMinutes: segment.plannedLengthMinutes,
            turnPersonId: segment.turnPersonId,
            turnTargetAlignment: segment.turnTargetAlignment,
          },
        });
        existing.add(segment.draftSegmentId);
        recorded += 1;

        if (!segment.programmeId) return;
        const programme = (state.programmes ?? []).find((candidate) => (
          candidate.id === segment.programmeId
          && candidate.promotionId === draft.promotionId
          && candidate.status === "ACTIVE"
        ));
        if (!programme) return;
        const alreadyRecorded = programmeActivities(state, programme.id).some((activity) => (
          activity.kind === "SEGMENT" && activity.eventId === event.id
        ));
        if (alreadyRecorded) return;
        const participantEntityIds = activityEntityIds(state, programme, segment);
        if (participantEntityIds.length === 0) return;
        recordProgrammeActivity(state, {
          programmeId: programme.id,
          kind: "SEGMENT",
          date: event.date,
          participantEntityIds,
          eventId: event.id,
        });
      });
    }
  }

  return recorded;
}

export function recordResolvedProgrammeSegments(
  state: WorldState,
  planning: WorldPlanningState,
): number {
  return recordResolvedShowSegments(state, planning);
}


export function applyResolvedShowTurns(state: WorldState): number {
  const turnSegments = state.ledger
    .filter((entry) => entry.type === RESOLVED_SEGMENT_LEDGER_TYPE && sameWeek(entry.date, state.world.currentDate))
    .map(resolvedSegmentFromLedger)
    .filter((segment): segment is ResolvedShowSegment => (
      segment !== null
      && segment.type === "TURN"
      && segment.turnPersonId !== null
      && segment.turnTargetAlignment !== null
    ))
    .sort((left, right) => left.slotOrder - right.slotOrder || left.ledgerId.localeCompare(right.ledgerId));

  let applied = 0;
  for (const segment of turnSegments) {
    const alreadyApplied = state.ledger.some((entry) => (
      entry.type === "PROMOTION_ALIGNMENT_CHANGED"
      && entry.payload.method === "TURN"
      && entry.payload.sourceEventId === segment.eventId
      && entry.payload.sourceSegmentId === segment.draftSegmentId
    ));
    if (alreadyApplied) continue;

    changePromotionWrestlerAlignment(
      state,
      segment.promotionId,
      segment.turnPersonId!,
      segment.turnTargetAlignment!,
      {
        method: "TURN",
        sourceEventId: segment.eventId,
        sourceSegmentId: segment.draftSegmentId,
      },
    );
    applied += 1;
  }
  return applied;
}
