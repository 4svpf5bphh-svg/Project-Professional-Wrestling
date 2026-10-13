import type { Id, PpwDate, WorldState } from "../../domain/src/types.js";
import { comparePpwDates, ppwDateToWeekIndex } from "../../sim-core/src/clock.js";

/** A Victory Lap refers to a completed on-screen win, not an intended finish,
 * a scheduled match, an advance booking or an unverified boast. */
export function recentCompletedVictoryForCelebration(
  state: WorldState,
  promotionId: Id,
  participantIds: readonly Id[],
  targetDate: PpwDate,
): boolean {
  if (participantIds.length === 0 || new Set(participantIds).size !== participantIds.length) return false;
  const perYear = state.ruleset.weeksPerYear;
  const currentWeek = ppwDateToWeekIndex(targetDate, perYear);
  const subjects = new Set(participantIds);
  return state.matches.some((match) => {
    if (match.promotionId !== promotionId || match.status !== "COMPLETED"
      || match.actualWinnerSide === null) return false;
    const event = state.events.find((entry) => entry.id === match.eventId);
    if (!event || event.status !== "COMPLETED" || event.promotionId !== promotionId
      || comparePpwDates(event.date, targetDate, perYear) >= 0) return false;
    const weeksAgo = currentWeek - ppwDateToWeekIndex(event.date, perYear);
    if (weeksAgo < 0 || weeksAgo > 6) return false;
    const winners = new Set(state.matchParticipants.filter((person) => (
      person.eventId === event.id && person.matchId === match.id && person.won
      && person.side === match.actualWinnerSide
    )).map((person) => person.personId));
    return [...subjects].every((personId) => winners.has(personId));
  });
}
