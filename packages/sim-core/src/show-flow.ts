import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { Match, MatchIntent, MatchParticipant, WorldState, WrestlingEvent } from "../../domain/src/types.js";
import { actualMatchFinish, finishCheaterSide } from "./match-finishes.js";
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
  | "REPEATED_STYLE"
  | "BACK_TO_BACK_INTENSITY"
  | "PACE_CONTRAST"
  | "INTENSITY_BUILD"
  | "BREATHER"
  | "HIGH_INTENSITY_STREAK"
  | "FLAT_CLOSER"
  | "BIG_CLOSER"
  | "HEEL_CHEATING_HEAT"
  | "FACE_CHEATING_BACKLASH"
  | "DIRTY_FINISH_FAMILIAR";

interface ModifierEvaluation {
  modifier: number;
  reason: ShowFlowReasonCode | null;
}

interface AlignmentModifierEvaluation extends ModifierEvaluation {
  baseModifier: number;
  baseReason: ShowFlowReasonCode | null;
  volatilityModifier: number;
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
  finishModifier: number;
  finishReason: ShowFlowReasonCode | null;
  finishRepeatCount: number;
  finishProgrammeLinked: boolean;
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

function alignmentModifierForMatch(state: WorldState, match: Match): AlignmentModifierEvaluation {
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
  return {
    modifier: volatility < -0.05 ? clamp(base.modifier + volatility, -3.5, 2.2) : base.modifier,
    reason: volatility < -0.05 ? "ALIGNMENT_VOLATILITY" : base.reason,
    baseModifier: base.modifier,
    baseReason: base.reason,
    volatilityModifier: volatility,
  };
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

interface FinishReactionEvaluation extends ModifierEvaluation {
  repeatCount: number;
  programmeLinked: boolean;
}

/** Only completed, side-validated cheating gets an audience reaction.
 * Programme heat/repetition already has its own modifier; replaying an identical
 * cheat only erodes the *extra* finish lift, never stacks another repetition loss. */
function finishReactionForMatch(state: WorldState, event: WrestlingEvent, match: Match): FinishReactionEvaluation {
  const none: FinishReactionEvaluation = { modifier: 0, reason: null, repeatCount: 0, programmeLinked: false };
  const actualFinish = actualMatchFinish(match);
  if (actualFinish !== "DISQUALIFICATION" && actualFinish !== "FOREIGN_OBJECT") return none;
  if (!match.actualWinnerSide || !match.finishCheaterPersonId) return none;
  const participants = participantsForMatch(state, match.id);
  const cheaterSide = finishCheaterSide(actualFinish, match.actualWinnerSide);
  const culprit = participants.find((person) => person.personId === match.finishCheaterPersonId);
  if (!culprit || culprit.side !== cheaterSide) return none;
  const cheatedSide = cheaterSide === "A" ? "B" : "A";
  const culpritAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, culprit.personId);
  const opposition = sideAlignment(state, event.promotionId, participants, cheatedSide);
  const linkedProgramme = programmeActivitiesForMatch(state, match.id)
    .some((activity) => activity.kind === "MATCH" && activity.eventId === event.id);
  const currentWeek = (event.date.year - 1) * state.ruleset.weeksPerYear + event.date.week - 1;
  const currentParticipants = participants.map((person) => person.personId).sort().join("|");
  // Search historical completed matches only. No same-show or future leakage.
  const historicalEvents = new Map(state.events
    .filter((candidate) => candidate.promotionId === event.promotionId)
    .map((candidate) => [candidate.id, candidate]));
  let repeatCount = 0;
  for (const previous of state.matches) {
    if (repeatCount >= 2) break;
    if (previous.id === match.id || previous.status !== "COMPLETED"
      || previous.promotionId !== match.promotionId
      || previous.finishCheaterPersonId !== culprit.personId
      || actualMatchFinish(previous) !== actualFinish) continue;
    const pastEvent = historicalEvents.get(previous.eventId);
    if (!pastEvent) continue;
    const pastWeek = (pastEvent.date.year - 1) * state.ruleset.weeksPerYear + pastEvent.date.week - 1;
    if (pastWeek >= currentWeek || pastWeek < currentWeek - 8) continue;
    const pastIds = participantsForMatch(state, previous.id).map((person) => person.personId).sort().join("|");
    if (pastIds === currentParticipants) repeatCount += 1;
  }
  if (culpritAlignment === "HEEL" && opposition === "FACE") {
    const freshLift = actualFinish === "FOREIGN_OBJECT" ? 1.8 : 1.2;
    const modifier = Math.max(0, freshLift - repeatCount * 0.9);
    return {
      modifier: round1(modifier),
      reason: modifier >= 0.45 ? "HEEL_CHEATING_HEAT" : "DIRTY_FINISH_FAMILIAR",
      repeatCount, programmeLinked: linkedProgramme,
    };
  }
  if (culpritAlignment === "FACE") {
    return { modifier: -1.3, reason: "FACE_CHEATING_BACKLASH", repeatCount, programmeLinked: linkedProgramme };
  }
  return { ...none, repeatCount, programmeLinked: linkedProgramme };
}

function styleIntensity(match: Match): number {
  if (match.style === undefined) return INTENT_INTENSITY[match.intent];
  return clamp(
    match.style.intensity * 0.45
      + match.style.epic * 0.25
      + match.style.risk * 0.12
      + match.style.competitiveness * 0.1
      + match.style.technical * 0.04
      + match.style.story * 0.04,
    0,
    100,
  );
}

function styleSimilarity(left: Match, right: Match): number | null {
  if (left.style === undefined || right.style === undefined) return null;
  const differences = [
    Math.abs(left.style.competitiveness - right.style.competitiveness),
    Math.abs(left.style.technical - right.style.technical),
    Math.abs(left.style.story - right.style.story),
    Math.abs(left.style.intensity - right.style.intensity),
    Math.abs(left.style.risk - right.style.risk),
    Math.abs(left.style.epic - right.style.epic),
  ];
  return 100 - differences.reduce((sum, value) => sum + value, 0) / differences.length;
}

function pacingModifier(matches: Match[], index: number): ModifierEvaluation {
  const match = matches[index]!;
  const intensity = styleIntensity(match);
  const isLast = index === matches.length - 1;
  const signals = new Map<ShowFlowReasonCode, number>();
  const add = (reason: ShowFlowReasonCode, impact: number): void => {
    signals.set(reason, (signals.get(reason) ?? 0) + impact);
  };

  if (index > 0) {
    const previous = matches[index - 1]!;
    const previousIntensity = styleIntensity(previous);
    const difference = intensity - previousIntensity;
    const absoluteDifference = Math.abs(difference);
    const similarity = styleSimilarity(previous, match);

    if (similarity !== null && similarity >= 82) add("REPEATED_STYLE", similarity >= 92 ? -1.1 : -0.8);
    else if (similarity === null && match.style === undefined && previous.style === undefined && match.intent === previous.intent) {
      add("REPEATED_INTENT", -0.8);
    }
    if (intensity >= 76 && previousIntensity >= 76) add("BACK_TO_BACK_INTENSITY", -1.8);
    if (absoluteDifference >= 14 && absoluteDifference <= 42) add("PACE_CONTRAST", 0.6);
    if (difference >= 10 && difference <= 45) add("INTENSITY_BUILD", 0.5);
    if (previousIntensity >= 76 && intensity <= 48 && !isLast) add("BREATHER", 0.8);
    if (previousIntensity - intensity >= 30 && isLast) add("FLAT_CLOSER", -0.8);
  }

  if (intensity >= 76) {
    let highIntensityStreak = 1;
    for (let prior = index - 1; prior >= 0 && styleIntensity(matches[prior]!) >= 76; prior -= 1) {
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
    const finish = finishReactionForMatch(state, event, match);
    const adjustedCrowdResponse = round1(clamp(
      match.crowdResponse + alignment.modifier + programme.modifier + pacing.modifier + finish.modifier,
      0,
      100,
    ));
    return {
      matchId: match.id,
      order: match.order,
      baseCrowdResponse: match.crowdResponse,
      alignmentModifier: round1(alignment.modifier),
      alignmentReason: alignment.reason,
      alignmentBaseModifier: round1(alignment.baseModifier),
      alignmentBaseReason: alignment.baseReason,
      alignmentVolatilityModifier: round1(alignment.volatilityModifier),
      programmeModifier: round1(programme.modifier),
      programmeReason: programme.reason,
      pacingModifier: round1(pacing.modifier),
      pacingReason: pacing.reason,
      finishModifier: round1(finish.modifier),
      finishReason: finish.reason,
      finishRepeatCount: finish.repeatCount,
      finishProgrammeLinked: finish.programmeLinked,
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
      matchLedger.payload.showFlowFinishModifier = matchEvaluation.finishModifier;
      matchLedger.payload.showFlowFinishReason = matchEvaluation.finishReason;
      matchLedger.payload.showFlowFinishRepeatCount = matchEvaluation.finishRepeatCount;
      matchLedger.payload.showFlowFinishProgrammeLinked = matchEvaluation.finishProgrammeLinked;
      matchLedger.payload.showFlowAdjustedCrowd = matchEvaluation.adjustedCrowdResponse;
      matchLedger.payload.showFlowWeight = round1(matchEvaluation.weight);
    }
    updated += 1;
  }
  return updated;
}
