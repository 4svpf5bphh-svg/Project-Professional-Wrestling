import type { PpwDate, Promotion, WorldState, WrestlingEventType } from "../../domain/src/types.js";
import { primaryPromotionShowSeriesForDate } from "../../sim-core/src/show-calendar.js";
import { showParticipantCapacityForEventType } from "../../sim-core/src/show-capacity.js";

/**
 * Application-facing alias for the sim-core capacity rule.
 * Keep planning/UI and event materialisation on the same authority.
 */
export function maxShowParticipantsForEventType(
  promotion: Promotion,
  eventType: WrestlingEventType,
): number {
  return showParticipantCapacityForEventType(promotion, eventType);
}

export function maxShowParticipantsForDate(
  state: WorldState,
  promotion: Promotion,
  date: PpwDate,
): number {
  const showSeries = primaryPromotionShowSeriesForDate(state, promotion.id, date);
  return maxShowParticipantsForEventType(promotion, showSeries?.eventType ?? "REGULAR");
}
