import type { Id, PpwDate, WorldState } from "../../domain/src/types.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";

/** Promotion-relative, completed *live* history. Video subjects never count as an appearance. */
export function previousLiveAppearanceDates(
  state: WorldState, promotionId: Id, personId: Id, targetDate: PpwDate,
): PpwDate[] {
  const events = state.events.filter((event) => (
    event.promotionId === promotionId && event.status === "COMPLETED"
    && comparePpwDates(event.date, targetDate, state.ruleset.weeksPerYear) < 0
  ));
  const dates = new Map<string, PpwDate>();
  for (const event of events) {
    const performedMatchIds = new Set(state.matches
      .filter((match) => match.eventId === event.id && match.status === "COMPLETED").map((match) => match.id));
    const appearedInMatch = state.matchParticipants.some((participant) => (
      performedMatchIds.has(participant.matchId) && participant.personId === personId
    ));
    const appearedInSegment = state.ledger.some((entry) => (
      entry.type === "SHOW_SEGMENT_COMPLETED"
      && entry.payload.eventId === event.id
      && entry.payload.segmentType !== "VIDEO_PACKAGE"
      && typeof entry.payload.participantIds === "string"
      && entry.payload.participantIds.split(",").includes(personId)
    ));
    if (appearedInMatch || appearedInSegment) {
      dates.set(`${event.date.year}:${event.date.week}:${event.date.day}`, event.date);
    }
  }
  return [...dates.values()].sort((a, b) => (
    comparePpwDates(b, a, state.ruleset.weeksPerYear)
  ));
}

/**
 * The history requirement validates the factual booking label; it never decides
 * the scripted action. A 4-week return is a clear first-test threshold.
 */
export function liveAppearanceHistoryError(
  state: WorldState,
  promotionId: Id,
  personId: Id,
  targetDate: PpwDate,
  kind: "DEBUT" | "RETURN" | "INTRODUCTION" | "SURPRISE_REVEAL",
): string | null {
  const previous = previousLiveAppearanceDates(state, promotionId, personId, targetDate);
  if (kind === "DEBUT" && previous.length > 0) {
    return "debut must be this wrestler's first completed live appearance for the promotion";
  }
  if (kind === "RETURN") {
    if (previous.length === 0) return "return needs an earlier live appearance for this promotion";
    const distance = ppwDateToWeekIndex(targetDate, state.ruleset.weeksPerYear)
      - ppwDateToWeekIndex(previous[0]!, state.ruleset.weeksPerYear);
    if (distance < 4) return "return requires at least four PPW weeks away from live appearances";
  }
  return null;
}
