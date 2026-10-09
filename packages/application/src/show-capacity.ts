import type { PpwDate, Promotion, WorldState } from "../../domain/src/types.js";
import { primaryPromotionShowSeriesForDate } from "../../sim-core/src/show-calendar.js";

/**
 * Authoritative maximum unique-wrestler capacity for a planned show.
 *
 * The STANDARD takeover-company override is an Alpha Reality Check affordance,
 * not the final show-capacity design. Show/Calendar architecture will replace
 * the tier-only model with show identity/importance expectations.
 */
export function maxShowParticipantsForDate(
  state: WorldState,
  promotion: Promotion,
  date: PpwDate,
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
  const showSeries = primaryPromotionShowSeriesForDate(state, promotion.id, date);
  return showSeries?.eventType === "MAJOR" ? regular + 2 : regular;
}
