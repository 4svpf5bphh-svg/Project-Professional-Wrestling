import type {
  Id,
  PromotionShowSeriesRole,
  PromotionTier,
  PpwDate,
  WrestlingEventType,
} from "../../domain/src/types.js";
import { promotionShowOccurrencesBetween } from "../../sim-core/src/show-calendar.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export interface PlayerWorldCalendarOccurrenceView {
  occurrenceId: Id;
  promotionId: Id;
  promotionName: string;
  promotionTier: PromotionTier;
  isPlayerPromotion: boolean;
  showSeriesId: Id;
  showName: string;
  role: PromotionShowSeriesRole;
  eventType: WrestlingEventType;
  eventImportance: number;
  year: number;
  week: number;
  day: number | null;
  marketId: Id | null;
  marketName: string | null;
  venueId: Id | null;
  venueName: string | null;
  eventId: Id | null;
  status: "CALENDAR" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
}

export interface PlayerWorldCalendarView {
  world: {
    worldId: Id;
    name: string;
    currentDate: PpwDate;
    revision: number;
  };
  player: {
    playerId: string;
    promotionId: Id | null;
  };
  horizonWeeks: number;
  occurrences: PlayerWorldCalendarOccurrenceView[];
}

function validatedHorizon(weeks: number): number {
  if (!Number.isSafeInteger(weeks) || weeks < 1 || weeks > 52) {
    throw new Error("world calendar horizon must be a whole number from 1 to 52 PPW weeks");
  }
  return weeks;
}

/**
 * Public upcoming calendar across the shared PPW World.
 *
 * Recurring show identities are public. Market, venue, day and event status
 * appear only once a canonical WrestlingEvent exists. Private planning drafts
 * are intentionally excluded, so another human player's uncommitted plans do
 * not leak through the World calendar.
 */
export function buildPlayerWorldCalendarView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
  weeks = 12,
): PlayerWorldCalendarView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);
  const horizonWeeks = validatedHorizon(weeks);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);

  const promotionsById = new Map(aggregate.state.promotions.map((promotion) => [promotion.id, promotion]));
  const marketsById = new Map(aggregate.state.markets.map((market) => [market.id, market]));
  const venuesById = new Map(aggregate.state.venues.map((venue) => [venue.id, venue]));

  const occurrences = promotionShowOccurrencesBetween(
    aggregate.state,
    aggregate.state.world.currentDate,
    horizonWeeks,
  ).map((occurrence): PlayerWorldCalendarOccurrenceView => {
    const promotion = promotionsById.get(occurrence.promotionId);
    return {
      occurrenceId: occurrence.id,
      promotionId: occurrence.promotionId,
      promotionName: promotion?.name ?? "Unknown promotion",
      promotionTier: promotion?.tier ?? "LOCAL",
      isPlayerPromotion: control?.promotionId === occurrence.promotionId,
      showSeriesId: occurrence.showSeriesId,
      showName: occurrence.name,
      role: occurrence.role,
      eventType: occurrence.eventType,
      eventImportance: occurrence.eventImportance,
      year: occurrence.year,
      week: occurrence.week,
      day: occurrence.day,
      marketId: occurrence.marketId,
      marketName: occurrence.marketId ? marketsById.get(occurrence.marketId)?.name ?? "Unknown market" : null,
      venueId: occurrence.venueId,
      venueName: occurrence.venueId ? venuesById.get(occurrence.venueId)?.name ?? "Unknown venue" : null,
      eventId: occurrence.eventId,
      status: occurrence.status,
    };
  });

  return {
    world: {
      worldId: aggregate.state.world.id,
      name: aggregate.state.world.name,
      currentDate: { ...aggregate.state.world.currentDate },
      revision: aggregate.runtime.revision,
    },
    player: {
      playerId,
      promotionId: control?.promotionId ?? null,
    },
    horizonWeeks,
    occurrences,
  };
}
