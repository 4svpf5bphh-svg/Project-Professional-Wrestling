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
  recentAlignmentVolatilityPenalty,
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

export type ResolvedSegmentOutcomeBand = "POOR" | "FLAT" | "SOLID" | "STRONG" | "HOT";

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
  executionQuality: number | null;
  crowdResponse: number | null;
  impact: number | null;
  outcomeBand: ResolvedSegmentOutcomeBand | null;
  programmeModifier: number;
  fatigueModifier: number;
  moraleModifier: number;
  alignmentVolatilityModifier: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function outcomeBand(value: number): ResolvedSegmentOutcomeBand {
  if (value >= 80) return "HOT";
  if (value >= 68) return "STRONG";
  if (value >= 55) return "SOLID";
  if (value >= 42) return "FLAT";
  return "POOR";
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

function segmentOutcome(
  state: WorldState,
  event: WorldState["events"][number],
  segment: NormalizedDraftSegment,
): {
  executionQuality: number;
  crowdResponse: number;
  impact: number;
  outcomeBand: ResolvedSegmentOutcomeBand;
  programmeModifier: number;
  fatigueModifier: number;
  moraleModifier: number;
  alignmentVolatilityModifier: number;
} {
  const people = segment.participantIds
    .map((personId) => state.people.find((person) => person.id === personId))
    .filter((person): person is WorldState["people"][number] => Boolean(person));
  const average = (selector: (person: WorldState["people"][number]) => number): number => (
    people.length > 0 ? people.reduce((sum, person) => sum + selector(person), 0) / people.length : 0
  );
  const presentation = average((person) => person.skills.presentation);
  const starPower = average((person) => (person.popularity + person.recognition) / 2);
  const momentum = average((person) => person.momentum);
  const morale = average((person) => person.morale);
  const fatigue = average((person) => person.fatigue);
  const weights: Record<DetailedShowSegmentType, [number, number, number]> = {
    PROMO: [0.62, 0.23, 0.15],
    INTERVIEW: [0.68, 0.20, 0.12],
    CONFRONTATION: [0.50, 0.32, 0.18],
    CHALLENGE: [0.56, 0.28, 0.16],
    ATTACK: [0.38, 0.34, 0.28],
    CELEBRATION: [0.40, 0.45, 0.15],
    TURN: [0.55, 0.25, 0.20],
  };
  const [presentationWeight, starWeight, momentumWeight] = weights[segment.type];
  const delivery = presentation * presentationWeight + starPower * starWeight + momentum * momentumWeight;
  const moraleModifier = round1((morale - 50) * 0.08);
  const fatigueModifier = round1(-fatigue * 0.10);
  const programme = segment.programmeId
    ? (state.programmes ?? []).find((candidate) => candidate.id === segment.programmeId)
    : null;
  const heatEffect = programme?.heat === null || programme?.heat === undefined
    ? 0
    : clamp((programme.heat - 50) / 10, -4, 4);
  const repetitionPenalty = programme ? Math.min(4, programme.repetition / 20) : 0;
  const programmeModifier = round1(heatEffect - repetitionPenalty);
  const alignmentVolatilityModifier = segment.type === "TURN" && segment.turnPersonId
    ? round1(recentAlignmentVolatilityPenalty(state, event.promotionId, [segment.turnPersonId]))
    : 0;
  const executionQuality = round1(clamp(
    delivery
      + moraleModifier
      + fatigueModifier
      + programmeModifier * 0.25
      + alignmentVolatilityModifier * 0.5,
    0,
    100,
  ));
  const crowdResponse = round1(clamp(
    executionQuality * 0.48
      + starPower * 0.34
      + event.eventImportance * 0.18
      + programmeModifier
      + alignmentVolatilityModifier,
    0,
    100,
  ));
  const impact = round1(clamp(
    executionQuality * 0.45 + crowdResponse * 0.45 + event.eventImportance * 0.10,
    0,
    100,
  ));
  return {
    executionQuality,
    crowdResponse,
    impact,
    outcomeBand: outcomeBand(crowdResponse),
    programmeModifier,
    fatigueModifier,
    moraleModifier,
    alignmentVolatilityModifier,
  };
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
  const turnPersonId = entry.payload.turnPersonId === undefined ? null : entry.payload.turnPersonId;
  const turnTargetAlignment = entry.payload.turnTargetAlignment === undefined ? null : entry.payload.turnTargetAlignment;
  const executionQuality = typeof entry.payload.segmentExecutionQuality === "number" ? entry.payload.segmentExecutionQuality : null;
  const crowdResponse = typeof entry.payload.segmentCrowdResponse === "number" ? entry.payload.segmentCrowdResponse : null;
  const impact = typeof entry.payload.segmentImpact === "number" ? entry.payload.segmentImpact : null;
  const outcome = typeof entry.payload.segmentOutcomeBand === "string" ? entry.payload.segmentOutcomeBand : null;
  const programmeModifier = typeof entry.payload.segmentProgrammeModifier === "number" ? entry.payload.segmentProgrammeModifier : 0;
  const fatigueModifier = typeof entry.payload.segmentFatigueModifier === "number" ? entry.payload.segmentFatigueModifier : 0;
  const moraleModifier = typeof entry.payload.segmentMoraleModifier === "number" ? entry.payload.segmentMoraleModifier : 0;
  const alignmentVolatilityModifier = typeof entry.payload.segmentAlignmentVolatilityModifier === "number"
    ? entry.payload.segmentAlignmentVolatilityModifier
    : 0;
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
    || (outcome !== null && !["POOR", "FLAT", "SOLID", "STRONG", "HOT"].includes(outcome))
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
    executionQuality,
    crowdResponse,
    impact,
    outcomeBand: outcome as ResolvedSegmentOutcomeBand | null,
    programmeModifier,
    fatigueModifier,
    moraleModifier,
    alignmentVolatilityModifier,
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
        const outcome = segmentOutcome(state, event, segment);
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
            segmentExecutionQuality: outcome.executionQuality,
            segmentCrowdResponse: outcome.crowdResponse,
            segmentImpact: outcome.impact,
            segmentOutcomeBand: outcome.outcomeBand,
            segmentProgrammeModifier: outcome.programmeModifier,
            segmentFatigueModifier: outcome.fatigueModifier,
            segmentMoraleModifier: outcome.moraleModifier,
            segmentAlignmentVolatilityModifier: outcome.alignmentVolatilityModifier,
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
