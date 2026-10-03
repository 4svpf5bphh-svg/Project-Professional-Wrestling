import type { Promotion, PromotionTier, WorldState } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { LedgerWriter } from "./ledger.js";

const TIER_ORDER: PromotionTier[] = ["LOCAL", "INDEPENDENT", "RISING", "NATIONAL", "GLOBAL"];
const PROMOTE_AT: Partial<Record<PromotionTier, number>> = {
  LOCAL: 35,
  INDEPENDENT: 50,
  RISING: 65,
  NATIONAL: 80,
};
const DEMOTE_BELOW: Partial<Record<PromotionTier, number>> = {
  INDEPENDENT: 29,
  RISING: 44,
  NATIONAL: 59,
  GLOBAL: 74,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function eventCadenceForTier(tier: PromotionTier): number {
  switch (tier) {
    case "GLOBAL":
    case "NATIONAL":
      return 1;
    case "RISING":
    case "INDEPENDENT":
      return 2;
    case "LOCAL":
      return 3;
  }
}

function recentEventPerformance(state: WorldState, promotionId: string): number {
  const currentWeek = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const earliestWeek = Math.max(0, currentWeek - state.ruleset.weeksPerYear + 1);
  let total = 0;
  let count = 0;
  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index]!;
    const eventWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    if (eventWeek < earliestWeek) break;
    if (event.promotionId !== promotionId || event.status !== "COMPLETED") continue;
    const demandRatio = event.expectedDemand > 0 ? event.attendance / event.expectedDemand : 0;
    const demandScore = clamp(demandRatio * 75, 0, 100);
    total += event.crowdResponse * 0.55 + demandScore * 0.45;
    count += 1;
  }
  return count > 0 ? total / count : 45;
}

function financialScaleScore(promotion: Promotion): number {
  switch (promotion.financialDistress) {
    case "HEALTHY": return 80;
    case "WATCH": return 60;
    case "DISTRESSED": return 38;
    case "CRISIS": return 15;
  }
}

export function promotionScaleScore(state: WorldState, promotion: Promotion): number {
  const localStates = state.promotionMarketStates.filter((entry) => entry.promotionId === promotion.id);
  const localScores = localStates
    .map((entry) => entry.liveStrength * 0.45 + entry.awareness * 0.35 + entry.loyalty * 0.2)
    .sort((a, b) => b - a);
  const coreMarkets = localScores.slice(0, Math.min(5, localScores.length));
  const coreStrength = coreMarkets.length > 0
    ? coreMarkets.reduce((sum, value) => sum + value, 0) / coreMarkets.length
    : 0;
  const breadth = localStates.length > 0
    ? localStates.filter((entry) => entry.awareness >= 25 && entry.liveStrength >= 20).length / localStates.length * 100
    : 0;
  const eventPerformance = recentEventPerformance(state, promotion.id);
  const score = coreStrength * 0.32
    + breadth * 0.16
    + promotion.mediaReach * 0.2
    + eventPerformance * 0.22
    + financialScaleScore(promotion) * 0.1;
  return Math.round(clamp(score, 0, 100) * 10) / 10;
}

export function tierForAnnualScaleEvaluation(currentTier: PromotionTier, score: number): PromotionTier {
  const index = TIER_ORDER.indexOf(currentTier);
  const promoteAt = PROMOTE_AT[currentTier];
  if (promoteAt !== undefined && score >= promoteAt && index < TIER_ORDER.length - 1) {
    return TIER_ORDER[index + 1]!;
  }
  const demoteBelow = DEMOTE_BELOW[currentTier];
  if (demoteBelow !== undefined && score < demoteBelow && index > 0) {
    return TIER_ORDER[index - 1]!;
  }
  return currentTier;
}

export function processPromotionTierGrowthForWeek(state: WorldState): void {
  if (state.world.currentDate.week !== state.ruleset.weeksPerYear) return;
  const writer = new LedgerWriter(state.world.id, state.ledger);
  for (const promotion of state.promotions) {
    if (promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED") continue;
    const score = promotionScaleScore(state, promotion);
    const previousTier = promotion.tier;
    const nextTier = tierForAnnualScaleEvaluation(previousTier, score);
    if (nextTier === previousTier) continue;

    promotion.tier = nextTier;
    const normalCadence = eventCadenceForTier(nextTier);
    const survival = state.promotionSurvivalStates?.find((entry) => entry.promotionId === promotion.id);
    if (survival) survival.baselineEventCadenceWeeks = normalCadence;
    if (promotion.lifecycle === "ACTIVE" || promotion.lifecycle === "FOUNDING") {
      promotion.eventCadenceWeeks = normalCadence;
    }

    writer.append({
      date: state.world.currentDate,
      type: "PROMOTION_TIER_CHANGED",
      significance: nextTier === "GLOBAL" || previousTier === "GLOBAL" ? "MAJOR" : "NOTABLE",
      entityIds: [promotion.id],
      payload: {
        fromTier: previousTier,
        toTier: nextTier,
        scaleScore: score,
        normalCadenceWeeks: normalCadence,
      },
    });
  }
}
