import type { Id, PpwDate, WorldState } from "../../domain/src/types.js";
import { comparePpwDates, weeksBetween } from "./clock.js";

/** Only completed on-site appearances count. Pre-recorded footage never counts. */
export function latestPromotionLiveAppearance(
  state: WorldState,
  promotionId: Id,
  personId: Id,
  beforeDate: PpwDate,
): PpwDate | null {
  const weeks = state.ruleset.weeksPerYear;
  const events = new Map(state.events.filter((event) =>
    event.promotionId === promotionId
    && event.status === "COMPLETED"
    && comparePpwDates(event.date, beforeDate, weeks) < 0
  ).map((event) => [event.id, event]));
  const completedIds = new Set<Id>();

  for (const booking of state.scheduledAppearances) {
    if (booking.promotionId === promotionId && booking.personId === personId
      && booking.status === "COMPLETED" && events.has(booking.eventId)) {
      completedIds.add(booking.eventId);
    }
  }
  for (const participant of state.matchParticipants) {
    if (participant.personId === personId && events.has(participant.eventId)) {
      completedIds.add(participant.eventId);
    }
  }
  for (const entry of state.ledger) {
    if (entry.type !== "SHOW_SEGMENT_COMPLETED") continue;
    const eventId = entry.payload.eventId;
    const people = entry.payload.participantIds;
    if (typeof eventId !== "string" || typeof people !== "string" || !events.has(eventId)) continue;
    if (people.split(",").includes(personId)) completedIds.add(eventId);
  }
  let latest: PpwDate | null = null;
  for (const eventId of completedIds) {
    const date = events.get(eventId)!.date;
    if (latest === null || comparePpwDates(date, latest, weeks) > 0) latest = date;
  }
  return latest;
}

export type LiveAppearanceKind = "DEBUT" | "RETURN" | "SURPRISE_REVEAL" | "INTRODUCTION";

export const RETURN_MINIMUM_ABSENCE_WEEKS = 4;

/** Stable, explainable eligibility: a return requires a real earlier show, not a video or an invented injury. */
export function validateLiveAppearanceHistory(
  state: WorldState,
  promotionId: Id,
  personId: Id,
  targetDate: PpwDate,
  kind: LiveAppearanceKind,
): void {
  const previous = latestPromotionLiveAppearance(state, promotionId, personId, targetDate);
  if (kind === "DEBUT" && previous !== null) {
    throw new Error("promotion debut requires no previous completed live appearance for this promotion");
  }
  if (kind === "RETURN") {
    if (previous === null) throw new Error("return requires an earlier live appearance; use Debut for a newcomer");
    const elapsed = weeksBetween(previous, targetDate, state.ruleset.weeksPerYear);
    if (elapsed < RETURN_MINIMUM_ABSENCE_WEEKS) {
      throw new Error(`return requires at least ${RETURN_MINIMUM_ABSENCE_WEEKS} PPW weeks since the last live appearance`);
    }
  }
}
