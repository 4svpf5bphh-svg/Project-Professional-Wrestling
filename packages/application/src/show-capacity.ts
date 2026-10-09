import type { PpwDate, Promotion, WorldState, WrestlingEventType } from "../../domain/src/types.js";
import { primaryPromotionShowSeriesForDate } from "../../sim-core/src/show-calendar.js";

/**
 * Authoritative maximum unique-wrestler capacity for a planned show.
 *
 * The STANDARD takeover-company override is an Alpha Reality Check affordance,
 * not the final show-capacity design. Show/Calendar architecture will replace
 * the tier-only model with show identity/importance expectations.
 */
export function maxShowParticipantsForEventType(
  promotion: Promotion,
  eventType: WrestlingEventType,
): number {
  const regular = promotion.playerTakeoverEligibility === "STANDARD"
    ? 20
    : promotion.tier === "GLOBAL"
      ? 16
      : promotion.tier === "NATIONAL"
        ? 14
        : promotion.tier === "RISING"
          ? 12
          : promotion.tier === "INDEPENDENT"
            ? 10
            : 8;
  return eventType === "MAJOR" ? regular + 2 : regular;
}

export function maxShowParticipantsForDate(
  state: WorldState,
  promotion: Promotion,
  date: PpwDate,
): number {
  const showSeries = primaryPromotionShowSeriesForDate(state, promotion.id, date);
  return maxShowParticipantsForEventType(promotion, showSeries?.eventType ?? "REGULAR");
}
