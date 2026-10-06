import type { Programme, ProgrammeActivity, ProgrammeActivityKind } from "../../domain/src/programmes.js";
import type { Match, WorldState, WrestlingEvent } from "../../domain/src/types.js";
import { programmeActivities, setProgrammeSignals } from "./programmes.js";

const HEAT_WINDOW_WEEKS = 10;
const REPETITION_WINDOW_WEEKS = 8;
const DENSITY_WINDOW_WEEKS = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function weekIndex(state: WorldState, date: { year: number; week: number }): number {
  return (date.year - 1) * state.ruleset.weeksPerYear + (date.week - 1);
}

function ageInWeeks(state: WorldState, activity: ProgrammeActivity): number {
  return weekIndex(state, state.world.currentDate) - weekIndex(state, activity.date);
}

function recencyWeight(ageWeeks: number, windowWeeks: number): number {
  if (ageWeeks < 0 || ageWeeks >= windowWeeks) return 0;
  return (windowWeeks - ageWeeks) / windowWeeks;
}

function activitySignature(activity: ProgrammeActivity): string {
  return `${activity.kind}:${[...activity.participantEntityIds].sort().join("|")}`;
}

function baseImpactForNonMatch(kind: ProgrammeActivityKind): number {
  switch (kind) {
    case "SEGMENT": return 58;
    case "INTERFERENCE": return 66;
    case "BETRAYAL": return 80;
    case "TITLE_CHANGE": return 84;
    case "OTHER": return 48;
    case "MATCH": return 50;
  }
}

function matchImpact(match: Match, event: WrestlingEvent | undefined, isMainEvent: boolean): number {
  const eventImportance = event?.eventImportance ?? 50;
  const execution = clamp(match.executionQuality, 0, 100);
  const crowd = clamp(match.crowdResponse, 0, 100);
  const impact = execution * 0.42 + crowd * 0.38 + clamp(eventImportance, 0, 100) * 0.2 + (isMainEvent ? 4 : 0);
  return clamp(impact, 0, 100);
}

export interface ProgrammeSignalEvaluation {
  heat: number | null;
  repetition: number;
  recentActivityCount: number;
  activeWeeks: number;
  latestActivityAgeWeeks: number | null;
  averageRecentImpact: number | null;
}

export function evaluateProgrammeSignals(state: WorldState, programme: Programme): ProgrammeSignalEvaluation {
  const history = programmeActivities(state, programme.id);
  if (history.length === 0) {
    return {
      heat: null,
      repetition: 0,
      recentActivityCount: 0,
      activeWeeks: 0,
      latestActivityAgeWeeks: null,
      averageRecentImpact: null,
    };
  }

  const eventsById = new Map(state.events.map((event) => [event.id, event]));
  const matchesById = new Map(state.matches.map((match) => [match.id, match]));
  const maxMatchOrderByEvent = new Map<string, number>();
  for (const match of state.matches) {
    if (match.status !== "COMPLETED") continue;
    maxMatchOrderByEvent.set(match.eventId, Math.max(maxMatchOrderByEvent.get(match.eventId) ?? 0, match.order));
  }

  const withAge = history
    .map((activity) => ({ activity, ageWeeks: ageInWeeks(state, activity) }))
    .filter(({ ageWeeks }) => ageWeeks >= 0);
  const latestActivityAgeWeeks = withAge.length ? Math.min(...withAge.map(({ ageWeeks }) => ageWeeks)) : null;

  const repetitionCandidates = withAge
    .filter(({ ageWeeks }) => ageWeeks < REPETITION_WINDOW_WEEKS)
    .sort((left, right) => left.ageWeeks - right.ageWeeks);
  const seenBySignature = new Map<string, number>();
  let repeatPressure = 0;
  for (const { activity, ageWeeks } of repetitionCandidates) {
    const signature = activitySignature(activity);
    const previous = seenBySignature.get(signature) ?? 0;
    if (previous > 0) {
      repeatPressure += 14 * recencyWeight(ageWeeks, REPETITION_WINDOW_WEEKS);
    }
    seenBySignature.set(signature, previous + 1);
  }

  const densityCandidates = withAge.filter(({ ageWeeks }) => ageWeeks < DENSITY_WINDOW_WEEKS);
  const activeWeekIndexes = new Set(densityCandidates.map(({ activity }) => weekIndex(state, activity.date)));
  const densityPressure = Math.max(0, activeWeekIndexes.size - 2) * 5;
  const currentWeekActivityCount = densityCandidates.filter(({ ageWeeks }) => ageWeeks === 0).length;
  const sameWeekPressure = Math.max(0, currentWeekActivityCount - 1) * 6;
  const repetition = clamp(repeatPressure + densityPressure + sameWeekPressure, 0, 100);

  const heatCandidates = withAge.filter(({ ageWeeks }) => ageWeeks < HEAT_WINDOW_WEEKS);
  let weightedImpactTotal = 0;
  let totalWeight = 0;
  let weightedActivityCount = 0;
  for (const { activity, ageWeeks } of heatCandidates) {
    const weight = recencyWeight(ageWeeks, HEAT_WINDOW_WEEKS);
    let impact = baseImpactForNonMatch(activity.kind);
    if (activity.kind === "MATCH" && activity.matchId) {
      const match = matchesById.get(activity.matchId);
      if (match) {
        const event = eventsById.get(match.eventId);
        impact = matchImpact(match, event, match.order === (maxMatchOrderByEvent.get(match.eventId) ?? match.order));
      }
    }
    weightedImpactTotal += impact * weight;
    totalWeight += weight;
    weightedActivityCount += weight;
  }

  if (totalWeight === 0 || latestActivityAgeWeeks === null) {
    return {
      heat: 10,
      repetition: 0,
      recentActivityCount: 0,
      activeWeeks: 0,
      latestActivityAgeWeeks,
      averageRecentImpact: null,
    };
  }

  const averageRecentImpact = weightedImpactTotal / totalWeight;
  const momentumBonus = Math.min(14, weightedActivityCount * 4);
  const inactivityPenalty = latestActivityAgeWeeks <= 1 ? 0 : Math.min(30, (latestActivityAgeWeeks - 1) * 5);
  const heat = clamp(
    15 + averageRecentImpact * 0.62 + momentumBonus - repetition * 0.27 - inactivityPenalty,
    0,
    100,
  );

  return {
    heat: Math.round(heat * 100) / 100,
    repetition: Math.round(repetition * 100) / 100,
    recentActivityCount: heatCandidates.length,
    activeWeeks: activeWeekIndexes.size,
    latestActivityAgeWeeks,
    averageRecentImpact: Math.round(averageRecentImpact * 100) / 100,
  };
}

/**
 * Recomputes active Programme signals from factual history for the current PPW week.
 * The calculation is deliberately derived rather than cumulative so retries are safe.
 */
export function updateProgrammeSignalsForCurrentWeek(state: WorldState): number {
  let updated = 0;
  for (const programme of state.programmes ?? []) {
    if (programme.status !== "ACTIVE") continue;
    const evaluation = evaluateProgrammeSignals(state, programme);
    setProgrammeSignals(state, programme.id, {
      heat: evaluation.heat,
      repetition: evaluation.repetition,
    });
    updated += 1;
  }
  return updated;
}
