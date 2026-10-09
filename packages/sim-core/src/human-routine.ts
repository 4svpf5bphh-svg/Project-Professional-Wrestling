import type { WorldState, WrestlingEvent } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { LedgerWriter } from "./ledger.js";
import { promotionShowSeriesDueForDate } from "./show-calendar.js";

export type HumanWeekReadinessStatus = "NOT_REQUIRED" | "READY" | "SHOW_REQUIRED" | "CARD_REQUIRED";
export type RoutineContinuityScope = "SHOW_AND_CARD" | "CARD_ONLY";

export interface HumanWeekReadiness {
  promotionId: string;
  status: HumanWeekReadinessStatus;
  readyToAdvance: boolean;
  eventId: string | null;
}

function currentWeekEvents(state: WorldState, promotionId: string): WrestlingEvent[] {
  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  return state.events.filter((event) => (
    event.promotionId === promotionId
    && event.status !== "CANCELLED"
    && ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) === weekIndex
  ));
}

function hasCompleteCard(state: WorldState, event: WrestlingEvent): boolean {
  const committedIds = new Set(
    state.scheduledAppearances
      .filter((appearance) => appearance.eventId === event.id && appearance.status === "COMMITTED")
      .map((appearance) => appearance.personId),
  );
  if (committedIds.size < state.ruleset.minEventParticipants) return false;

  const matchIds = new Set(
    state.matches
      .filter((match) => match.eventId === event.id && match.status === "SCHEDULED")
      .map((match) => match.id),
  );
  if (matchIds.size === 0) return false;

  const usage = new Map<string, number>();
  for (const participant of state.matchParticipants) {
    if (!matchIds.has(participant.matchId)) continue;
    if (!committedIds.has(participant.personId)) return false;
    usage.set(participant.personId, (usage.get(participant.personId) ?? 0) + 1);
  }

  if (usage.size !== committedIds.size) return false;
  return [...committedIds].every((personId) => usage.get(personId) === 1);
}

export function humanWeekReadiness(state: WorldState, promotionId: string): HumanWeekReadiness {
  const promotion = state.promotions.find((candidate) => candidate.id === promotionId);
  if (!promotion) throw new Error(`unknown promotion ${promotionId}`);
  if (promotion.controllerType !== "HUMAN") throw new Error("week readiness is only defined for a human-controlled promotion");

  const dueSeries = promotionShowSeriesDueForDate(state, promotion.id, state.world.currentDate);
  if (dueSeries.length === 0) {
    return { promotionId, status: "NOT_REQUIRED", readyToAdvance: true, eventId: null };
  }

  const events = currentWeekEvents(state, promotion.id);
  const matchedEvents = dueSeries.map((series) => (
    events.find((event) => event.showSeriesId === series.id)
      ?? (dueSeries.length === 1 ? events.find((event) => !event.showSeriesId) ?? null : null)
  ));
  if (matchedEvents.some((event) => event === null)) {
    return { promotionId, status: "SHOW_REQUIRED", readyToAdvance: false, eventId: null };
  }

  const incomplete = matchedEvents.find((event) => event !== null && !hasCompleteCard(state, event)) ?? null;
  if (incomplete) {
    return { promotionId, status: "CARD_REQUIRED", readyToAdvance: false, eventId: incomplete.id };
  }
  return { promotionId, status: "READY", readyToAdvance: true, eventId: matchedEvents[0]?.id ?? null };
}

export function prepareRoutineContinuityForWeek(state: WorldState): Map<string, RoutineContinuityScope> {
  const takeovers = new Map<string, RoutineContinuityScope>();
  const writer = new LedgerWriter(state.world.id, state.ledger);

  for (const promotion of state.promotions) {
    if (promotion.controllerType !== "HUMAN") continue;
    const readiness = humanWeekReadiness(state, promotion.id);
    if (readiness.readyToAdvance) continue;

    const scope: RoutineContinuityScope = readiness.status === "SHOW_REQUIRED" ? "SHOW_AND_CARD" : "CARD_ONLY";
    takeovers.set(promotion.id, scope);
    writer.append({
      date: state.world.currentDate,
      type: "HUMAN_ROUTINE_CONTINUITY_TAKEOVER",
      significance: "NOTABLE",
      entityIds: [promotion.id, ...(readiness.eventId ? [readiness.eventId] : [])],
      payload: {
        scope,
        unresolvedStatus: readiness.status,
        reason: "week locked with unresolved mandatory show work",
      },
    });
  }

  return takeovers;
}
