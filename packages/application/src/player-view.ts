import type {
  ContractFamily,
  FinancialDistressState,
  Id,
  PersonStatus,
  PpwDate,
  PromotionLifecycle,
  PromotionTier,
} from "../../domain/src/types.js";
import { humanWeekReadiness, type HumanWeekReadinessStatus } from "../../sim-core/src/human-routine.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export interface AlphaRosterMemberView {
  personId: Id;
  name: string;
  status: PersonStatus;
  morale: number;
  momentum: number;
  popularity: number;
  contractFamily: ContractFamily;
  datesRemaining: number;
}

export interface AlphaPromotionChoiceView {
  promotionId: Id;
  name: string;
  homeMarketName: string;
  cash: number;
  financialDistress: FinancialDistressState;
}

export interface AlphaWeekReadinessView {
  status: HumanWeekReadinessStatus;
  readyToFinish: boolean;
  eventId: Id | null;
  staffHelpRequired: boolean;
}

export interface AlphaResolvedShowView {
  eventId: Id;
  year: number;
  week: number;
  day: number;
  marketName: string;
  venueName: string;
  attendance: number;
  gateRevenue: number;
  totalCost: number;
  netResult: number;
  matchCount: number;
  averageMatchRating: number;
  bestMatchRating: number;
  crowdResponse: number;
}

export interface AlphaControlledPromotionView {
  promotionId: Id;
  name: string;
  tier: PromotionTier;
  lifecycle: PromotionLifecycle;
  homeMarketName: string;
  cash: number;
  debt: number;
  lastWeeklyNet: number;
  runwayWeeks: number | null;
  financialDistress: FinancialDistressState;
  roster: AlphaRosterMemberView[];
  planningDraftCount: number;
  reservationCount: number;
  weekReadiness: AlphaWeekReadinessView;
  lastResolvedShow: AlphaResolvedShowView | null;
}

export interface AlphaPlayerWorldView {
  world: {
    worldId: Id;
    name: string;
    year: number;
    week: number;
    day: number;
    phase: ApplicationWorldAggregate["runtime"]["phase"];
    revision: number;
    lastResolvedPpwDate: PpwDate | null;
  };
  player: {
    playerId: string;
    promotionId: Id | null;
  };
  promotion: AlphaControlledPromotionView | null;
  availableIndependentPromotions: AlphaPromotionChoiceView[];
}

function marketName(aggregate: ApplicationWorldAggregate, marketId: Id): string {
  return aggregate.state.markets.find((market) => market.id === marketId)?.name ?? "Unknown market";
}

function venueName(aggregate: ApplicationWorldAggregate, venueId: Id): string {
  return aggregate.state.venues.find((venue) => venue.id === venueId)?.name ?? "Unknown venue";
}

function samePpwWeek(left: PpwDate, right: PpwDate): boolean {
  return left.year === right.year && left.week === right.week;
}

function lastResolvedShowForPromotion(
  aggregate: ApplicationWorldAggregate,
  promotionId: Id,
): AlphaResolvedShowView | null {
  const resolvedDate = aggregate.runtime.lastResolvedPpwDate;
  if (!resolvedDate) return null;

  const event = aggregate.state.events
    .filter((candidate) => (
      candidate.promotionId === promotionId
      && candidate.status === "COMPLETED"
      && samePpwWeek(candidate.date, resolvedDate)
    ))
    .sort((a, b) => b.date.day - a.date.day || b.id.localeCompare(a.id))[0];
  if (!event) return null;

  return {
    eventId: event.id,
    year: event.date.year,
    week: event.date.week,
    day: event.date.day,
    marketName: marketName(aggregate, event.marketId),
    venueName: venueName(aggregate, event.venueId),
    attendance: event.attendance,
    gateRevenue: event.gateRevenue,
    totalCost: event.totalCost,
    netResult: event.netResult,
    matchCount: event.matchCount,
    averageMatchRating: event.averageMatchRating,
    bestMatchRating: event.bestMatchRating,
    crowdResponse: event.crowdResponse,
  };
}

export function buildAlphaPlayerWorldView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
): AlphaPlayerWorldView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);

  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const promotion = control
    ? aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId) ?? null
    : null;

  const controlledPromotion: AlphaControlledPromotionView | null = promotion
    ? (() => {
      const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
      const roster = aggregate.state.contracts
        .filter((contract) => contract.promotionId === promotion.id && contract.status === "SIGNED")
        .map((contract) => {
          const person = peopleById.get(contract.personId);
          if (!person) return null;
          return {
            personId: person.id,
            name: person.name,
            status: person.status,
            morale: person.morale,
            momentum: person.momentum,
            popularity: person.popularity,
            contractFamily: contract.family,
            datesRemaining: Math.max(0, contract.dateEntitlement - contract.datesUsed),
          } satisfies AlphaRosterMemberView;
        })
        .filter((entry): entry is AlphaRosterMemberView => entry !== null)
        .sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name));
      const workspace = aggregate.planning.workspaces.find((candidate) => candidate.promotionId === promotion.id);
      const reservationCount = aggregate.planning.showReservations.filter(
        (reservation) => reservation.promotionId === promotion.id,
      ).length;
      const readiness = humanWeekReadiness(aggregate.state, promotion.id);
      return {
        promotionId: promotion.id,
        name: promotion.name,
        tier: promotion.tier,
        lifecycle: promotion.lifecycle,
        homeMarketName: marketName(aggregate, promotion.homeMarketId),
        cash: promotion.cash,
        debt: promotion.debt,
        lastWeeklyNet: promotion.lastWeeklyNet,
        runwayWeeks: promotion.runwayWeeks,
        financialDistress: promotion.financialDistress,
        roster,
        planningDraftCount: workspace?.detailedShowDrafts.length ?? 0,
        reservationCount,
        weekReadiness: {
          status: readiness.status,
          readyToFinish: readiness.readyToAdvance,
          eventId: readiness.eventId,
          staffHelpRequired: !readiness.readyToAdvance,
        },
        lastResolvedShow: lastResolvedShowForPromotion(aggregate, promotion.id),
      };
    })()
    : null;

  const availableIndependentPromotions = control
    ? []
    : aggregate.state.promotions
      .filter((candidate) => (
        candidate.controllerType === "AI"
        && candidate.tier === "INDEPENDENT"
        && candidate.lifecycle === "ACTIVE"
      ))
      .map((candidate) => ({
        promotionId: candidate.id,
        name: candidate.name,
        homeMarketName: marketName(aggregate, candidate.homeMarketId),
        cash: candidate.cash,
        financialDistress: candidate.financialDistress,
      }))
      .sort((a, b) => b.cash - a.cash || a.name.localeCompare(b.name));

  const date = aggregate.state.world.currentDate;
  return {
    world: {
      worldId: aggregate.state.world.id,
      name: aggregate.state.world.name,
      year: date.year,
      week: date.week,
      day: date.day,
      phase: aggregate.runtime.phase,
      revision: aggregate.runtime.revision,
      lastResolvedPpwDate: aggregate.runtime.lastResolvedPpwDate
        ? { ...aggregate.runtime.lastResolvedPpwDate }
        : null,
    },
    player: {
      playerId: membership.playerId,
      promotionId: control?.promotionId ?? null,
    },
    promotion: controlledPromotion,
    availableIndependentPromotions,
  };
}
