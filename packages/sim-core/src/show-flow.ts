import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { Match, MatchIntent, MatchParticipant, WorldState, WrestlingEvent } from "../../domain/src/types.js";
import {
  recentAlignmentVolatilityPenalty,
  wrestlerAlignmentForPromotion,
} from "./alignment.js";
import {
  eventsForWeek,
  matchesForEvent,
  participantsForMatch,
  personById,
  programmeActivitiesForMatch,
  programmeById,
} from "./indexes.js";

const INTENT_INTENSITY: Record<MatchIntent, number> = {
  COMPETITIVE: 58,
  SHOWCASE: 40,
  DOMINANT: 44,
  TECHNICAL: 54,
  HIGH_RISK: 82,
  STORY: 42,
  PROTECTIVE: 38,
  EPIC: 90,
};

type SideAlignment = WrestlerAlignment | "MIXED" | null;

export type ShowFlowReasonCode =
  | "FACE_HEEL_CLARITY"
  | "SAME_ALIGNMENT"
  | "TWEENER_TENSION"
  | "ALIGNMENT_VOLATILITY"
  | "HOT_PROGRAMME"
  | "PROGRAMME_REPETITION"
  | "COOL_PROGRAMME"
  | "REPEATED_INTENT"
  | "BACK_TO_BACK_INTENSITY"
  | "PACE_CONTRAST"
  | "INTENSITY_BUILD"
  | "BREATHER"
  | "HIGH_INTENSITY_STREAK"
  | "FLAT_CLOSER"
  | "BIG_CLOSER";

interface ModifierEvaluation {
  modifier: number;
  reason: ShowFlowReasonCode | null;
}

export interface ShowFlowMatchEvaluation {
  matchId: string;
  order: number;
  baseCrowdResponse: number;
  alignmentModifier: number;
  alignmentReason: ShowFlowReasonCode | null;
  alignmentBaseModifier: number;
  alignmentBaseReason: ShowFlowReasonCode | null;
  alignmentVolatilityModifier: number;
  programmeModifier: number;
  programmeReason: ShowFlowReasonCode | null;
  pacingModifier: number;
  pacingReason: ShowFlowReasonCode | null;
  adjustedCrowdResponse: number;
  weight: number;
}

export interface ShowFlowEvaluation {
  eventId: string;
  baseCrowdResponse: number;
  crowdResponse: number;
  adjustment: number;
  matches: ShowFlowMatchEvaluation[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}


function sideAlignment(
  state: WorldState,
  promotionId: string,
  participants: readonly MatchParticipant[],
  side: "A" | "B",
): SideAlignment {
  const alignments = participants
    .filter((participant) => participant.side === side)
    .map((participant) => personById(state, participant.personId))
    .filter((person): person is NonNullable<ReturnType<typeof personById>> => Boolean(person))
    .map((person) => wrestlerAlignmentForPromotion(state, promotionId, person.id));
  if (alignments.length === 0) return null;
  const unique = new Set(alignments);
  return unique.size === 1 ? alignments[0]! : "MIXED";
}

function alignmentModifierForMatch(state: WorldState, match: Match): ModifierEvaluation {
  const participants = participantsForMatch(state, match.id);
  const a = sideAlignment(state, match.promotionId, participants, "A");
  const b = sideAlignment(state, match.promotionId, participants, "B");
  let base: ModifierEvaluation = { modifier: 0, reason: null };
  if (a && b && a !== "MIXED" && b !== "MIXED") {
    if ((a === "FACE" && b === "HEEL") || (a === "HEEL" && b === "FACE")) {
      base = { modifier: 2.2, reason: "FACE_HEEL_CLARITY" };
    } else if (a === b) {
      base = { modifier: a === "TWEENER" ? -0.1 : -0.3, reason: "SAME_ALIGNMENT" };
    } else if (a === "TWEENER" || b === "TWEENER") {
      base = { modifier: 0.7, reason: "TWEENER_TENSION" };
    }
  }

  const volatility = recentAlignmentVolatilityPenalty(
    state,
    match.promotionId,
    participants.map((participant) => participant.personId),
  );
  if (volatility < -0.05) {
    return {
      modifier: clamp(base.modifier + volatility, -3.5, 2.2),
      reason: "ALIGNMENT_VOLATILITY",
    };
  }
  return base;
}

function programmeModifierForMatch(state: WorldState, event: WrestlingEvent, match: Match): ModifierEvaluation {
  const programmeIds = new Set(
    programmeActivitiesForMatch(state, match.id)
      .filter((activity) => activity.kind === "MATCH" && activity.eventId === event.id)
      .map((activity) => activity.programmeId),
  );
  if (programmeIds.size === 0) return { modifier: 0, reason: null };

  const components = [...programmeIds].flatMap((programmeId) => {
    const programme = programmeById(state, programmeId);
    if (!programme || programme.status !== "ACTIVE" || programme.promotionId !== event.promotionId) return [];
    return [{
      heatEffect: programme.heat === null ? 0 : clamp((programme.heat - 50) / 15, -2, 2.5),
      repetitionPenalty: Math.min(3.5, programme.repetition * 0.04),
    }];
  });
  if (components.length === 0) return { modifier: 0, reason: null };

  const heatEffect = components.reduce((sum, component) => sum + component.heatEffect, 0) / components.length;
  const repetitionPenalty = components.reduce((sum, component) => sum + component.repetitionPenalty, 0) / components.length;
  const modifier = clamp(heatEffect - repetitionPenalty, -3.5, 2.5);
  let reason: ShowFlowReasonCode | null = null;
  if (repetitionPenalty >= Math.abs(heatEffect) && repetitionPenalty >= 0.25) reason = "PROGRAMME_REPETITION";
  else if (heatEffect >= 0.25) reason = "HOT_PROGRAMME";
  else if (heatEffect <= -0.25) reason = "COOL_PROGRAMME";
  else if (repetitionPenalty >= 0.25) reason = "PROGRAMME_REPETITION";
  return { modifier, reason };
}

function pacingModifier(matches: Match[], index: number): ModifierEvaluation {
  const match = matches[index]!;
  const intensity = INTENT_INTENSITY[match.intent];
  const isLast = index === matches.length - 1;
  const signals = new Map<ShowFlowReasonCode, number>();
  const add = (reason: ShowFlowReasonCode, impact: number): void => {
    signals.set(reason, (signals.get(reason) ?? 0) + impact);
  };

  if (index > 0) {
    const previous = matches[index - 1]!;
    const previousIntensity = INTENT_INTENSITY[previous.intent];
    const difference = intensity - previousIntensity;
    const absoluteDifference = Math.abs(difference);

    if (match.intent === previous.intent) add("REPEATED_INTENT", -0.8);
    if (intensity >= 76 && previousIntensity >= 76) add("BACK_TO_BACK_INTENSITY", -1.8);
    if (absoluteDifference >= 14 && absoluteDifference <= 42) add("PACE_CONTRAST", 0.6);
    if (difference >= 10 && difference <= 45) add("INTENSITY_BUILD", 0.5);
    if (previousIntensity >= 76 && intensity <= 48 && !isLast) add("BREATHER", 0.8);
    if (previousIntensity - intensity >= 30 && isLast) add("FLAT_CLOSER", -0.8);
  }

  if (intensity >= 76) {
    let highIntensityStreak = 1;
    for (let prior = index - 1; prior >= 0 && INTENT_INTENSITY[matches[prior]!.intent] >= 76; prior -= 1) {
      highIntensityStreak += 1;
    }
    if (highIntensityStreak >= 3) {
      add("HIGH_INTENSITY_STREAK", -Math.min(2.4, (highIntensityStreak - 2) * 1.2));
    }
  }

  if (isLast) {
    if (intensity >= 78) add("BIG_CLOSER", 1.2);
    else if (intensity <= 45) add("FLAT_CLOSER", -1.3);
  }

  const rawModifier = [...signals.values()].reduce((sum, value) => sum + value, 0);
  const reason = [...signals.entries()]
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))[0]?.[0] ?? null;
  return { modifier: clamp(rawModifier, -5, 3), reason };
}

function matchWeight(index: number, total: number): number {
  if (total <= 1) return 1;
  const position = index / (total - 1);
  return 1 + position * 0.18 + (index === total - 1 ? 0.08 : 0);
}

/**
 * Evaluates how an already-resolved ordered card played as a whole. Individual
 * match crowd scores remain the dominant input. This layer only adds contextual
 * audience psychology: alignment clarity, established Programme investment and
 * sequencing/burnout across the show.
 */
export function evaluateShowFlow(
  state: WorldState,
  event: WrestlingEvent,
  completedMatches: readonly Match[],
): ShowFlowEvaluation {
  const matches = completedMatches
    .filter((match) => match.status === "COMPLETED" && match.eventId === event.id)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

  if (matches.length === 0) {
    return { eventId: event.id, baseCrowdResponse: 0, crowdResponse: 0, adjustment: 0, matches: [] };
  }

  const rawMatchBaseCrowdResponse = round1(
    matches.reduce((sum, match) => sum + match.crowdResponse, 0) / matches.length,
  );
  const segmentCrowd = state.ledger
    .filter((entry) => entry.type === "SHOW_SEGMENT_COMPLETED" && entry.payload.eventId === event.id)
    .map((entry) => ({
      order: typeof entry.payload.slotOrder === "number" ? entry.payload.slotOrder : Number.MAX_SAFE_INTEGER,
      crowdResponse: entry.payload.segmentCrowdResponse,
    }))
    .filter((entry): entry is { order: number; crowdResponse: number } => (
      typeof entry.crowdResponse === "number" && Number.isFinite(entry.crowdResponse)
    ))
    .sort((left, right) => left.order - right.order);
  const evaluations = matches.map((match, index): ShowFlowMatchEvaluation => {
    const alignment = alignmentModifierForMatch(state, match);
    const programme = programmeModifierForMatch(state, event, match);
    const pacing = pacingModifier(matches, index);
    const adjustedCrowdResponse = round1(clamp(
      match.crowdResponse + alignment.modifier + programme.modifier + pacing.modifier,
      0,
      100,
    ));
    const participants = participantsForMatch(state, match.id);
    const volatility = recentAlignmentVolatilityPenalty(
      state,
      match.promotionId,
      participants.map((participant) => participant.personId),
    );
    const alignmentBaseModifier = round1(alignment.modifier - volatility);
    const alignmentVolatilityModifier = round1(volatility);
    return {
      matchId: match.id,
      order: match.order,
      baseCrowdResponse: match.crowdResponse,
      alignmentModifier: round1(alignment.modifier),
      alignmentReason: alignment.reason,
      alignmentBaseModifier,
      alignmentBaseReason: Math.abs(alignmentBaseModifier) >= 0.05
        ? (
          alignmentBaseModifier > 0
            ? (
              (() => {
                const a = sideAlignment(state, match.promotionId, participants, "A");
                const b = sideAlignment(state, match.promotionId, participants, "B");
                if ((a === "FACE" && b === "HEEL") || (a === "HEEL" && b === "FACE")) return "FACE_HEEL_CLARITY";
                if (a === "TWEENER" || b === "TWEENER") return "TWEENER_TENSION";
                return alignment.reason === "ALIGNMENT_VOLATILITY" ? null : alignment.reason;
              })()
            )
            : "SAME_ALIGNMENT"
        )
        : null,
      alignmentVolatilityModifier,
      programmeModifier: round1(programme.modifier),
      programmeReason: programme.reason,
      pacingModifier: round1(pacing.modifier),
      pacingReason: pacing.reason,
      adjustedCrowdResponse,
      weight: matchWeight(index, matches.length),
    };
  });

  const matchWeightTotal = evaluations.reduce((sum, evaluation) => sum + evaluation.weight, 0);
  const segmentWeight = 0.65;
  const segmentWeightTotal = segmentCrowd.length * segmentWeight;
  const totalWeight = matchWeightTotal + segmentWeightTotal;
  const baseCrowdResponse = segmentCrowd.length === 0
    ? rawMatchBaseCrowdResponse
    : round1(
      (
        evaluations.reduce((sum, evaluation) => sum + evaluation.baseCrowdResponse * evaluation.weight, 0)
        + segmentCrowd.reduce((sum, segment) => sum + segment.crowdResponse * segmentWeight, 0)
      ) / totalWeight,
    );
  const crowdResponse = round1(
    (
      evaluations.reduce((sum, evaluation) => sum + evaluation.adjustedCrowdResponse * evaluation.weight, 0)
      + segmentCrowd.reduce((sum, segment) => sum + segment.crowdResponse * segmentWeight, 0)
    ) / totalWeight,
  );
  return {
    eventId: event.id,
    baseCrowdResponse,
    crowdResponse,
    adjustment: round1(crowdResponse - baseCrowdResponse),
    matches: evaluations,
  };
}

function eventCompletedLedgerEntry(state: WorldState, eventId: string) {
  for (let index = state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = state.ledger[index]!;
    if (entry.type === "EVENT_COMPLETED" && entry.entityIds.includes(eventId)) return entry;
  }
  return null;
}

function matchCompletedLedgerEntry(state: WorldState, matchId: string) {
  for (let index = state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = state.ledger[index]!;
    if (entry.type === "MATCH_COMPLETED" && entry.entityIds.includes(matchId)) return entry;
  }
  return null;
}

/**
 * Applies show-flow aggregation after current-week Programme matches/segments
 * have been recorded but before Programme signals and annual promotion standing
 * are evaluated. The exact explanatory evidence is frozen into ledger history,
 * so old shows never get reinterpreted using later Programme heat/repetition.
 */
export function applyCurrentWeekShowFlow(state: WorldState): number {
  let updated = 0;
  for (const event of eventsForWeek(state, state.world.currentDate)) {
    if (event.status !== "COMPLETED") continue;
    const matches = matchesForEvent(state, event.id).filter((match) => match.status === "COMPLETED");
    if (matches.length === 0) continue;

    const eventLedger = eventCompletedLedgerEntry(state, event.id);
    if (eventLedger?.payload.showFlowFrozen === true && typeof eventLedger.payload.crowdResponse === "number") {
      event.crowdResponse = eventLedger.payload.crowdResponse;
      updated += 1;
      continue;
    }

    const evaluation = evaluateShowFlow(state, event, matches);
    event.crowdResponse = evaluation.crowdResponse;
    if (eventLedger) {
      eventLedger.payload.crowdResponse = evaluation.crowdResponse;
      eventLedger.payload.showFlowBaseCrowdResponse = evaluation.baseCrowdResponse;
      eventLedger.payload.showFlowAdjustment = evaluation.adjustment;
      eventLedger.payload.showFlowFrozen = true;
    }

    for (const matchEvaluation of evaluation.matches) {
      const matchLedger = matchCompletedLedgerEntry(state, matchEvaluation.matchId);
      if (!matchLedger) continue;
      matchLedger.payload.showFlowAlignmentModifier = matchEvaluation.alignmentModifier;
      matchLedger.payload.showFlowAlignmentReason = matchEvaluation.alignmentReason;
      matchLedger.payload.showFlowAlignmentBaseModifier = matchEvaluation.alignmentBaseModifier;
      matchLedger.payload.showFlowAlignmentBaseReason = matchEvaluation.alignmentBaseReason;
      matchLedger.payload.showFlowAlignmentVolatilityModifier = matchEvaluation.alignmentVolatilityModifier;
      matchLedger.payload.showFlowAlignmentVolatilityReason = matchEvaluation.alignmentVolatilityModifier < -0.05
        ? "ALIGNMENT_VOLATILITY"
        : null;
      matchLedger.payload.showFlowProgrammeModifier = matchEvaluation.programmeModifier;
      matchLedger.payload.showFlowProgrammeReason = matchEvaluation.programmeReason;
      matchLedger.payload.showFlowPacingModifier = matchEvaluation.pacingModifier;
      matchLedger.payload.showFlowPacingReason = matchEvaluation.pacingReason;
      matchLedger.payload.showFlowAdjustedCrowd = matchEvaluation.adjustedCrowdResponse;
      matchLedger.payload.showFlowWeight = round1(matchEvaluation.weight);
    }
    updated += 1;
  }
  return updated;
}
