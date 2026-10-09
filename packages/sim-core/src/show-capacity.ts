import type { Promotion, WrestlingEventType } from "../../domain/src/types.js";

/**
 * Canonical unique-wrestler capacity for one show.
 *
 * The 20-person STANDARD takeover allowance is an Alpha Reality Check affordance
 * and only applies after that promotion is human-controlled. AI promotions retain
 * their normal tier capacity.
 */
export function showParticipantCapacityForEventType(
  promotion: Promotion,
  eventType: WrestlingEventType,
): number {
  const regular = promotion.controllerType === "HUMAN" && promotion.playerTakeoverEligibility === "STANDARD"
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
