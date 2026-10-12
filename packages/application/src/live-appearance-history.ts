import type { Id, PpwDate, WorldState } from "../../domain/src/types.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";

/** A return is a meaningful promotion-specific absence, not just one missed show. */
export const MIN_RETURN_ABSENCE_WEEKS = 4 as const;

export type PromotionLiveAppearanceStatus = "DEBUT_ELIGIBLE" | "RETURN_ELIGIBLE" | "ESTABLISHED";

export interface PromotionLiveAppearanceHistory {
  status: PromotionLiveAppearanceStatus;
  lastAppearanceDate: PpwDate | null;
  weeksSinceLastAppearance: number | null;
  appearanceCount: number;
}

/**
 * Completed, physical appearances for one person in one promotion *before* a
 * future show date. Historical video packages and unfulfilled bookings never
 * become an on-screen debut. A match, run-in or live segment is also a real
 * appearance; several records from one show count as one appearance.
 *
 * Older show records can lack COMPLETED ScheduledAppearance entries, so a
 * completed match or resolved live segment acts as a factual fallback.
 */
export function promotionLiveAppearanceHistory(
  state: Pick<WorldState, "ruleset" | "events" | "scheduledAppearances" | "matchParticipants" | "matches" | "ledger">,
  promotionId: Id,
  personId: Id,
  showDate: PpwDate,
): PromotionLiveAppearanceHistory {
  const weeksPerYear = state.ruleset.weeksPerYear;
  const completedEvents = new Map(state.events
    .filter((event) => event.promotionId === promotionId && event.status === "COMPLETED"
      && comparePpwDates(event.date, showDate, weeksPerYear) < 0)
    .map((event) => [event.id, event]));
  const onScreen = new Set<Id>();
  for (const appearance of state.scheduledAppearances) {
    if (appearance.personId === personId && appearance.promotionId === promotionId
      && appearance.status === "COMPLETED" && completedEvents.has(appearance.eventId)) {
      onScreen.add(appearance.eventId);
    }
  }
  const completedMatchIds = new Set(state.matches
    .filter((match) => match.promotionId === promotionId && match.status === "COMPLETED"
      && completedEvents.has(match.eventId))
    .map((match) => match.id));
  for (const participant of state.matchParticipants) {
    if (participant.personId === personId && completedMatchIds.has(participant.matchId)
      && completedEvents.has(participant.eventId)) onScreen.add(participant.eventId);
  }
  for (const match of state.matches) {
    if (match.promotionId === promotionId && match.status === "COMPLETED"
      && match.interference?.personId === personId && completedEvents.has(match.eventId)) {
      onScreen.add(match.eventId);
    }
  }
  for (const entry of state.ledger) {
    if (entry.type !== "SHOW_SEGMENT_COMPLETED") continue;
    const payload = entry.payload;
    const eventId = payload.eventId;
    if (typeof eventId !== "string" || !completedEvents.has(eventId)) continue;
    if (payload.promotionId !== promotionId || payload.segmentType === "VIDEO_PACKAGE") continue;
    if (typeof payload.participantIds === "string"
      && payload.participantIds.split(",").includes(personId)) onScreen.add(eventId);
  }
  const dates = [...onScreen].map((id) => completedEvents.get(id)!.date)
    .sort((left, right) => comparePpwDates(left, right, weeksPerYear));
  const last = dates.at(-1) ?? null;
  const weeksSinceLastAppearance = last === null ? null
    : ppwDateToWeekIndex(showDate, weeksPerYear) - ppwDateToWeekIndex(last, weeksPerYear);
  return {
    status: last === null ? "DEBUT_ELIGIBLE"
      : weeksSinceLastAppearance! >= MIN_RETURN_ABSENCE_WEEKS ? "RETURN_ELIGIBLE" : "ESTABLISHED",
    lastAppearanceDate: last ? { ...last } : null,
    weeksSinceLastAppearance,
    appearanceCount: dates.length,
  };
}
