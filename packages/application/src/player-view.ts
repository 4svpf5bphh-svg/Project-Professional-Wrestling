import type { ContractFamily, FinancialDistressState, Id, PersonStatus, PromotionLifecycle, PromotionTier } from "../../domain/src/types.js";
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
    },
    player: {
      playerId: membership.playerId,
      promotionId: control?.promotionId ?? null,
    },
    promotion: controlledPromotion,
    availableIndependentPromotions,
  };
}
