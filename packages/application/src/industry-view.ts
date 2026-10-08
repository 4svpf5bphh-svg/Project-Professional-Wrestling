import type {
  CareerStage,
  ChampionshipDivision,
  Id,
  PromotionLifecycle,
  PromotionTier,
  PpwDate,
  WrestlingEventType,
} from "../../domain/src/types.js";
import {
  activeContractsForPromotion,
  ppwDateToWeekIndex,
} from "../../sim-core/src/index.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export interface PlayerIndustryStandingView {
  prestige: number;
  fanReputation: number;
  businessReputation: number;
  talentReputation: number;
}

export interface PlayerIndustryTalentView {
  personId: Id;
  name: string;
  careerStage: CareerStage;
  popularity: number;
  recognition: number;
  momentum: number;
}

export interface PlayerIndustryChampionshipView {
  championshipId: Id;
  name: string;
  division: ChampionshipDivision;
  holderName: string | null;
  defenses: number;
  reignStartDate: PpwDate | null;
}

export interface PlayerIndustryShowView {
  eventId: Id;
  date: PpwDate;
  type: WrestlingEventType;
  marketName: string;
  venueName: string;
  attendance: number;
  averageMatchRating: number;
  bestMatchRating: number;
  crowdResponse: number;
}

export interface PlayerIndustryPromotionView {
  promotionId: Id;
  name: string;
  tier: PromotionTier;
  lifecycle: PromotionLifecycle;
  homeMarketName: string;
  isPlayerPromotion: boolean;
  worldRank: number | null;
  standing: PlayerIndustryStandingView | null;
  rosterSize: number;
  featuredTalent: PlayerIndustryTalentView[];
  championships: PlayerIndustryChampionshipView[];
  recentShows: PlayerIndustryShowView[];
}

export interface PlayerIndustryView {
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
  promotions: PlayerIndustryPromotionView[];
}

const TIER_WEIGHT: Record<PromotionTier, number> = {
  GLOBAL: 5,
  NATIONAL: 4,
  RISING: 3,
  INDEPENDENT: 2,
  LOCAL: 1,
};

function dateOrder(aggregate: ApplicationWorldAggregate, date: PpwDate): number {
  return ppwDateToWeekIndex(date, aggregate.state.ruleset.weeksPerYear) * 7 + date.day;
}

function holderName(aggregate: ApplicationWorldAggregate, holderId: Id): string {
  const person = aggregate.state.people.find((candidate) => candidate.id === holderId);
  if (person) return person.name;
  const team = (aggregate.state.teams ?? []).find((candidate) => candidate.id === holderId);
  return team?.name ?? "Unknown holder";
}

/**
 * Public competitive projection of the PPW industry. It deliberately excludes
 * rival cash/debt, weekly economics, contract IDs/terms, pending offers,
 * wrestler Morale/fatigue/Wear and private planning state.
 */
export function buildPlayerIndustryView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
): PlayerIndustryView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const marketsById = new Map(aggregate.state.markets.map((market) => [market.id, market]));
  const venuesById = new Map(aggregate.state.venues.map((venue) => [venue.id, venue]));
  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const reignsById = new Map((aggregate.state.championshipReigns ?? []).map((reign) => [reign.id, reign]));
  const standingsByPromotion = new Map((aggregate.state.promotionStandings ?? []).map((standing) => [standing.promotionId, standing]));

  const rankedIds = aggregate.state.promotions
    .filter((promotion) => promotion.lifecycle !== "CLOSED")
    .slice()
    .sort((left, right) => {
      const tierDifference = TIER_WEIGHT[right.tier] - TIER_WEIGHT[left.tier];
      if (tierDifference !== 0) return tierDifference;
      const leftStanding = standingsByPromotion.get(left.id);
      const rightStanding = standingsByPromotion.get(right.id);
      const prestigeDifference = (rightStanding?.prestige ?? 0) - (leftStanding?.prestige ?? 0);
      if (prestigeDifference !== 0) return prestigeDifference;
      const fanDifference = (rightStanding?.fanReputation ?? 0) - (leftStanding?.fanReputation ?? 0);
      if (fanDifference !== 0) return fanDifference;
      return left.name.localeCompare(right.name);
    })
    .map((promotion) => promotion.id);
  const rankByPromotion = new Map(rankedIds.map((promotionId, index) => [promotionId, index + 1]));

  const promotions = aggregate.state.promotions.map((promotion): PlayerIndustryPromotionView => {
    const standing = standingsByPromotion.get(promotion.id) ?? null;
    const activeContracts = activeContractsForPromotion(aggregate.state, promotion.id);
    const rosterPeople = [...new Set(activeContracts.map((contract) => contract.personId))]
      .map((personId) => peopleById.get(personId))
      .filter((person): person is NonNullable<typeof person> => person !== undefined);
    const featuredTalent = rosterPeople
      .slice()
      .sort((left, right) => (
        right.popularity - left.popularity
        || right.recognition - left.recognition
        || left.name.localeCompare(right.name)
      ))
      .slice(0, 8)
      .map((person): PlayerIndustryTalentView => ({
        personId: person.id,
        name: person.name,
        careerStage: person.careerStage,
        popularity: person.popularity,
        recognition: person.recognition,
        momentum: person.momentum,
      }));

    const championships = (aggregate.state.championships ?? [])
      .filter((championship) => championship.promotionId === promotion.id && championship.status === "ACTIVE")
      .map((championship): PlayerIndustryChampionshipView => {
        const reign = championship.currentReignId ? reignsById.get(championship.currentReignId) ?? null : null;
        return {
          championshipId: championship.id,
          name: championship.name,
          division: championship.division,
          holderName: reign?.status === "ACTIVE" ? holderName(aggregate, reign.holderId) : null,
          defenses: reign?.status === "ACTIVE" ? reign.defenses : 0,
          reignStartDate: reign?.status === "ACTIVE" ? { ...reign.startDate } : null,
        };
      })
      .sort((left, right) => left.division.localeCompare(right.division) || left.name.localeCompare(right.name));

    const recentShows = aggregate.state.events
      .filter((event) => event.promotionId === promotion.id && event.status === "COMPLETED")
      .sort((left, right) => dateOrder(aggregate, right.date) - dateOrder(aggregate, left.date) || right.id.localeCompare(left.id))
      .slice(0, 5)
      .map((event): PlayerIndustryShowView => ({
        eventId: event.id,
        date: { ...event.date },
        type: event.type,
        marketName: marketsById.get(event.marketId)?.name ?? "Unknown market",
        venueName: venuesById.get(event.venueId)?.name ?? "Unknown venue",
        attendance: event.attendance,
        averageMatchRating: event.averageMatchRating,
        bestMatchRating: event.bestMatchRating,
        crowdResponse: event.crowdResponse,
      }));

    return {
      promotionId: promotion.id,
      name: promotion.name,
      tier: promotion.tier,
      lifecycle: promotion.lifecycle,
      homeMarketName: marketsById.get(promotion.homeMarketId)?.name ?? "Unknown market",
      isPlayerPromotion: control?.promotionId === promotion.id,
      worldRank: promotion.lifecycle === "CLOSED" ? null : rankByPromotion.get(promotion.id) ?? null,
      standing: standing ? {
        prestige: standing.prestige,
        fanReputation: standing.fanReputation,
        businessReputation: standing.businessReputation,
        talentReputation: standing.talentReputation,
      } : null,
      rosterSize: rosterPeople.length,
      featuredTalent,
      championships,
      recentShows,
    };
  }).sort((left, right) => {
    if (left.worldRank !== null && right.worldRank !== null) return left.worldRank - right.worldRank;
    if (left.worldRank !== null) return -1;
    if (right.worldRank !== null) return 1;
    return left.name.localeCompare(right.name);
  });

  return {
    world: {
      worldId: aggregate.state.world.id,
      name: aggregate.state.world.name,
      currentDate: { ...aggregate.state.world.currentDate },
      revision: aggregate.runtime.revision,
    },
    player: {
      playerId: membership.playerId,
      promotionId: control?.promotionId ?? null,
    },
    promotions,
  };
}
