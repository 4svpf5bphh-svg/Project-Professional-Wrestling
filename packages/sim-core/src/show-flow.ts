import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { Match, MatchIntent, MatchParticipant, Person, WorldState, WrestlingEvent } from "../../domain/src/types.js";
import { wrestlerAlignment } from "./alignment.js";

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

export interface ShowFlowMatchEvaluation {
  matchId: string;
  order: number;
  baseCrowdResponse: number;
  alignmentModifier: number;
  programmeModifier: number;
  pacingModifier: number;
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

function sameWeek(left: { year: number; week: number }, right: { year: number; week: number }): boolean {
  return left.year === right.year && left.week === right.week;
}

function participantsForMatch(state: WorldState, matchId: string): MatchParticipant[] {
  return state.matchParticipants.filter((participant) => participant.matchId === matchId);
}

function sideAlignment(
  state: WorldState,
  participants: MatchParticipant[],
  side: "A" | "B",
): SideAlignment {
  const peopleById = new Map(state.people.map((person) => [person.id, person]));
  const alignments = participants
    .filter((participant) => participant.side === side)
    .map((participant) => peopleById.get(participant.personId))
    .filter((person): person is Person => Boolean(person))
    .map((person) => wrestlerAlignment(person, state.world.seed));
  if (alignments.length === 0) return null;
  const unique = new Set(alignments);
  return unique.size === 1 ? alignments[0]! : "MIXED";
}

function alignmentModifierForMatch(state: WorldState, match: Match): number {
  const participants = participantsForMatch(state, match.id);
  const a = sideAlignment(state, participants, "A");
  const b = sideAlignment(state, participants, "B");
  if (!a || !b || a === "MIXED" || b === "MIXED") return 0;
  if ((a === "FACE" && b === "HEEL") || (a === "HEEL" && b === "FACE")) return 2.2;
  if (a === b) return a === "TWEENER" ? -0.1 : -0.3;
  if (a === "TWEENER" || b === "TWEENER") return 0.7;
  return 0;
}

function programmeModifierForMatch(state: WorldState, event: WrestlingEvent, match: Match): number {
  const programmeIds = new Set(
    (state.programmeActivities ?? [])
      .filter((activity) => (
        activity.kind === "MATCH"
        && activity.matchId === match.id
        && activity.eventId === event.id
      ))
      .map((activity) => activity.programmeId),
  );
  if (programmeIds.size === 0) return 0;

  const modifiers = (state.programmes ?? [])
    .filter((programme) => (
      programmeIds.has(programme.id)
      && programme.status === "ACTIVE"
      && programme.promotionId === event.promotionId
    ))
    .map((programme) => {
      const heatEffect = programme.heat === null
        ? 0
        : clamp((programme.heat - 50) / 15, -2, 2.5);
      const repetitionPenalty = Math.min(3.5, programme.repetition * 0.04);
      return heatEffect - repetitionPenalty;
    });
  if (modifiers.length === 0) return 0;
  return clamp(modifiers.reduce((sum, value) => sum + value, 0) / modifiers.length, -3.5, 2.5);
}

function pacingModifier(matches: Match[], index: number): number {
  const match = matches[index]!;
  const intensity = INTENT_INTENSITY[match.intent];
  const isLast = index === matches.length - 1;
  let modifier = 0;

  if (index > 0) {
    const previous = matches[index - 1]!;
    const previousIntensity = INTENT_INTENSITY[previous.intent];
    const difference = intensity - previousIntensity;
    const absoluteDifference = Math.abs(difference);

    if (match.intent === previous.intent) modifier -= 0.8;
    if (intensity >= 76 && previousIntensity >= 76) modifier -= 1.8;
    if (absoluteDifference >= 14 && absoluteDifference <= 42) modifier += 0.6;
    if (difference >= 10 && difference <= 45) modifier += 0.5;
    if (previousIntensity >= 76 && intensity <= 48 && !isLast) modifier += 0.8;
    if (previousIntensity - intensity >= 30 && isLast) modifier -= 0.8;
  }

  if (intensity >= 76) {
    let highIntensityStreak = 1;
    for (let prior = index - 1; prior >= 0 && INTENT_INTENSITY[matches[prior]!.intent] >= 76; prior -= 1) {
      highIntensityStreak += 1;
    }
    if (highIntensityStreak >= 3) modifier -= Math.min(2.4, (highIntensityStreak - 2) * 1.2);
  }

  if (isLast) {
    if (intensity >= 78) modifier += 1.2;
    else if (intensity <= 45) modifier -= 1.3;
  }

  return clamp(modifier, -5, 3);
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
  completedMatches: Match[],
): ShowFlowEvaluation {
  const matches = completedMatches
    .filter((match) => match.status === "COMPLETED" && match.eventId === event.id)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

  if (matches.length === 0) {
    return { eventId: event.id, baseCrowdResponse: 0, crowdResponse: 0, adjustment: 0, matches: [] };
  }

  const baseCrowdResponse = round1(
    matches.reduce((sum, match) => sum + match.crowdResponse, 0) / matches.length,
  );
  const evaluations = matches.map((match, index): ShowFlowMatchEvaluation => {
    const alignmentModifier = alignmentModifierForMatch(state, match);
    const programmeModifier = programmeModifierForMatch(state, event, match);
    const pacing = pacingModifier(matches, index);
    const adjustedCrowdResponse = round1(clamp(
      match.crowdResponse + alignmentModifier + programmeModifier + pacing,
      0,
      100,
    ));
    return {
      matchId: match.id,
      order: match.order,
      baseCrowdResponse: match.crowdResponse,
      alignmentModifier: round1(alignmentModifier),
      programmeModifier: round1(programmeModifier),
      pacingModifier: round1(pacing),
      adjustedCrowdResponse,
      weight: matchWeight(index, matches.length),
    };
  });

  const totalWeight = evaluations.reduce((sum, evaluation) => sum + evaluation.weight, 0);
  const crowdResponse = round1(
    evaluations.reduce((sum, evaluation) => sum + evaluation.adjustedCrowdResponse * evaluation.weight, 0) / totalWeight,
  );
  return {
    eventId: event.id,
    baseCrowdResponse,
    crowdResponse,
    adjustment: round1(crowdResponse - baseCrowdResponse),
    matches: evaluations,
  };
}

/**
 * Applies show-flow aggregation after current-week Programme matches/segments
 * have been recorded but before Programme signals and annual promotion standing
 * are evaluated. It changes only the event-level crowd response and keeps the
 * already-written event ledger payload consistent with that final value.
 */
export function applyCurrentWeekShowFlow(state: WorldState): number {
  let updated = 0;
  for (const event of state.events) {
    if (event.status !== "COMPLETED" || !sameWeek(event.date, state.world.currentDate)) continue;
    const matches = state.matches.filter((match) => match.eventId === event.id && match.status === "COMPLETED");
    if (matches.length === 0) continue;

    const evaluation = evaluateShowFlow(state, event, matches);
    event.crowdResponse = evaluation.crowdResponse;
    for (let index = state.ledger.length - 1; index >= 0; index -= 1) {
      const entry = state.ledger[index]!;
      if (entry.type !== "EVENT_COMPLETED" || !entry.entityIds.includes(event.id)) continue;
      entry.payload.crowdResponse = evaluation.crowdResponse;
      entry.payload.showFlowAdjustment = evaluation.adjustment;
      break;
    }
    updated += 1;
  }
  return updated;
}
