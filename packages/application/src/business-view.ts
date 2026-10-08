import type {
  FinancialDistressState,
  FinancialTransactionCategory,
  Id,
  PromotionLifecycle,
  PromotionTier,
  PpwDate,
} from "../../domain/src/types.js";
import { activeContractsForPromotion } from "../../sim-core/src/contracts.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export interface PlayerBusinessStandingView {
  prestige: number;
  fanReputation: number;
  businessReputation: number;
  talentReputation: number;
}

export interface PlayerBusinessCategoryTotalView {
  category: FinancialTransactionCategory;
  amount: number;
}

export interface PlayerBusinessTransactionView {
  transactionId: Id;
  date: PpwDate;
  category: FinancialTransactionCategory;
  amount: number;
}

export interface PlayerBusinessShowView {
  eventId: Id;
  date: PpwDate;
  marketName: string;
  venueName: string;
  attendance: number;
  gateRevenue: number;
  totalCost: number;
  netResult: number;
}

export interface PlayerBusinessPromotionView {
  promotionId: Id;
  name: string;
  tier: PromotionTier;
  lifecycle: PromotionLifecycle;
  homeMarketName: string;
  cash: number;
  debt: number;
  mediaReach: number;
  lastWeeklyNet: number;
  runwayWeeks: number | null;
  financialDistress: FinancialDistressState;
  eventCadenceWeeks: number;
  recurringWeekly: {
    mediaIncome: number;
    sponsorIncome: number;
    fixedOverhead: number;
    contractGuarantees: number;
    marginBeforeEventCosts: number;
  };
  rollingFourWeeks: {
    income: number;
    spending: number;
    net: number;
    byCategory: PlayerBusinessCategoryTotalView[];
  };
  standing: PlayerBusinessStandingView | null;
  recentShows: PlayerBusinessShowView[];
  recentTransactions: PlayerBusinessTransactionView[];
}

export interface PlayerBusinessView {
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
  promotion: PlayerBusinessPromotionView | null;
}

function dateOrder(aggregate: ApplicationWorldAggregate, date: PpwDate): number {
  return ppwDateToWeekIndex(date, aggregate.state.ruleset.weeksPerYear) * 7 + date.day;
}

function marketName(aggregate: ApplicationWorldAggregate, marketId: Id): string {
  return aggregate.state.markets.find((market) => market.id === marketId)?.name ?? "Unknown market";
}

function venueName(aggregate: ApplicationWorldAggregate, venueId: Id): string {
  return aggregate.state.venues.find((venue) => venue.id === venueId)?.name ?? "Unknown venue";
}

export function buildPlayerBusinessView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
): PlayerBusinessView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);

  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const promotion = control
    ? aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId) ?? null
    : null;
  const currentDate = aggregate.state.world.currentDate;

  let controlled: PlayerBusinessPromotionView | null = null;
  if (promotion) {
    const signedContracts = activeContractsForPromotion(aggregate.state, promotion.id);
    const contractGuarantees = signedContracts.reduce((total, contract) => total + contract.weeklyGuarantee, 0);
    const recurringIncome = promotion.weeklyMediaIncome + promotion.weeklySponsorIncome;

    const ownTransactions = aggregate.state.financialTransactions
      .filter((transaction) => transaction.promotionId === promotion.id)
      .sort((left, right) => dateOrder(aggregate, right.date) - dateOrder(aggregate, left.date) || right.id.localeCompare(left.id));

    const currentWeekIndex = ppwDateToWeekIndex(currentDate, aggregate.state.ruleset.weeksPerYear);
    const rollingStart = Math.max(0, currentWeekIndex - 3);
    const rollingTransactions = ownTransactions.filter((transaction) => {
      const transactionWeek = ppwDateToWeekIndex(transaction.date, aggregate.state.ruleset.weeksPerYear);
      return transactionWeek >= rollingStart && transactionWeek <= currentWeekIndex;
    });
    const income = rollingTransactions.reduce((total, transaction) => total + Math.max(0, transaction.amount), 0);
    const spending = rollingTransactions.reduce((total, transaction) => total + Math.max(0, -transaction.amount), 0);
    const categoryTotals = new Map<FinancialTransactionCategory, number>();
    for (const transaction of rollingTransactions) {
      categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) ?? 0) + transaction.amount);
    }

    const standing = aggregate.state.promotionStandings?.find((entry) => entry.promotionId === promotion.id) ?? null;
    const recentShows = aggregate.state.events
      .filter((event) => event.promotionId === promotion.id && event.status === "COMPLETED")
      .sort((left, right) => dateOrder(aggregate, right.date) - dateOrder(aggregate, left.date) || right.id.localeCompare(left.id))
      .slice(0, 8)
      .map((event) => ({
        eventId: event.id,
        date: { ...event.date },
        marketName: marketName(aggregate, event.marketId),
        venueName: venueName(aggregate, event.venueId),
        attendance: event.attendance,
        gateRevenue: event.gateRevenue,
        totalCost: event.totalCost,
        netResult: event.netResult,
      }));

    controlled = {
      promotionId: promotion.id,
      name: promotion.name,
      tier: promotion.tier,
      lifecycle: promotion.lifecycle,
      homeMarketName: marketName(aggregate, promotion.homeMarketId),
      cash: promotion.cash,
      debt: promotion.debt,
      mediaReach: promotion.mediaReach,
      lastWeeklyNet: promotion.lastWeeklyNet,
      runwayWeeks: promotion.runwayWeeks,
      financialDistress: promotion.financialDistress,
      eventCadenceWeeks: promotion.eventCadenceWeeks,
      recurringWeekly: {
        mediaIncome: promotion.weeklyMediaIncome,
        sponsorIncome: promotion.weeklySponsorIncome,
        fixedOverhead: promotion.weeklyFixedOverhead,
        contractGuarantees,
        marginBeforeEventCosts: recurringIncome - promotion.weeklyFixedOverhead - contractGuarantees,
      },
      rollingFourWeeks: {
        income,
        spending,
        net: income - spending,
        byCategory: [...categoryTotals.entries()]
          .map(([category, amount]) => ({ category, amount }))
          .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount) || left.category.localeCompare(right.category)),
      },
      standing: standing ? {
        prestige: standing.prestige,
        fanReputation: standing.fanReputation,
        businessReputation: standing.businessReputation,
        talentReputation: standing.talentReputation,
      } : null,
      recentShows,
      recentTransactions: ownTransactions.slice(0, 8).map((transaction) => ({
        transactionId: transaction.id,
        date: { ...transaction.date },
        category: transaction.category,
        amount: transaction.amount,
      })),
    };
  }

  return {
    world: {
      worldId: aggregate.state.world.id,
      name: aggregate.state.world.name,
      currentDate: { ...currentDate },
      revision: aggregate.runtime.revision,
    },
    player: {
      playerId: membership.playerId,
      promotionId: control?.promotionId ?? null,
    },
    promotion: controlled,
  };
}
