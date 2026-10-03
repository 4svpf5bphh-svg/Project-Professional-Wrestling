import type {
  FinancialDistressState,
  Promotion,
  PromotionStanding,
  PromotionTier,
  WorldState,
  WrestlingEvent,
} from "../../domain/src/types.js";
import { LedgerWriter } from "./ledger.js";

const INITIAL_STANDING: Record<PromotionTier, { prestige: number; fan: number; business: number }> = {
  GLOBAL: { prestige: 82, fan: 78, business: 82 },
  NATIONAL: { prestige: 67, fan: 65, business: 70 },
  RISING: { prestige: 50, fan: 52, business: 56 },
  INDEPENDENT: { prestige: 36, fan: 40, business: 44 },
  LOCAL: { prestige: 24, fan: 30, business: 34 },
};

const TIER_PRESTIGE: Record<PromotionTier, number> = {
  GLOBAL: 90,
  NATIONAL: 74,
  RISING: 57,
  INDEPENDENT: 40,
  LOCAL: 25,
};

const FINANCIAL_REPUTATION: Record<FinancialDistressState, number> = {
  HEALTHY: 88,
  WATCH: 66,
  DISTRESSED: 40,
  CRISIS: 18,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function blend(current: number, evidence: number, weight: number): number {
  return round1(clamp(current + (evidence - current) * weight));
}

export function ensurePromotionStandings(state: WorldState): PromotionStanding[] {
  if (!state.promotionStandings) state.promotionStandings = [];
  for (const promotion of state.promotions) {
    if (state.promotionStandings.some((entry) => entry.promotionId === promotion.id)) continue;
    const initial = INITIAL_STANDING[promotion.tier];
    state.promotionStandings.push({
      worldId: state.world.id,
      promotionId: promotion.id,
      prestige: initial.prestige,
      fanReputation: initial.fan,
      businessReputation: initial.business,
      lastEvaluatedYear: 0,
    });
  }
  return state.promotionStandings;
}

export function promotionStandingFor(state: WorldState, promotionId: string): PromotionStanding {
  const standing = ensurePromotionStandings(state).find((entry) => entry.promotionId === promotionId);
  if (!standing) throw new Error(`missing promotion standing for ${promotionId}`);
  return standing;
}

function annualEvents(state: WorldState, promotionId: string): WrestlingEvent[] {
  const year = state.world.currentDate.year;
  const result: WrestlingEvent[] = [];
  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index]!;
    if (event.date.year < year) break;
    if (event.date.year === year && event.promotionId === promotionId) result.push(event);
  }
  return result;
}

function fanEvidence(state: WorldState, promotion: Promotion, events: WrestlingEvent[]): number {
  const completed = events.filter((event) => event.status === "COMPLETED");
  const crowd = completed.length > 0
    ? completed.reduce((sum, event) => sum + event.crowdResponse, 0) / completed.length
    : promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED" ? 20 : 35;

  const venueById = new Map(state.venues.map((venue) => [venue.id, venue]));
  const demand = completed.length > 0
    ? completed.reduce((sum, event) => {
      const venue = venueById.get(event.venueId);
      const realisticDemand = Math.max(1, Math.min(event.expectedDemand, venue?.capacity ?? event.expectedDemand));
      return sum + clamp(event.attendance / realisticDemand * 100, 0, 105);
    }, 0) / completed.length
    : promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED" ? 15 : 30;

  const loyalty = state.promotionMarketStates
    .filter((entry) => entry.promotionId === promotion.id)
    .map((entry) => entry.loyalty)
    .sort((a, b) => b - a)
    .slice(0, 5);
  const loyaltyScore = loyalty.length > 0 ? loyalty.reduce((sum, value) => sum + value, 0) / loyalty.length : 20;

  return round1(clamp(crowd * 0.5 + demand * 0.3 + loyaltyScore * 0.2));
}

function restructuringCountThisYear(state: WorldState, promotionId: string): number {
  const year = state.world.currentDate.year;
  let count = 0;
  for (let index = state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = state.ledger[index]!;
    if (entry.date.year < year) break;
    if (entry.date.year !== year || entry.type !== "PROMOTION_RESTRUCTURED") continue;
    if (entry.entityIds.includes(promotionId)) count += 1;
  }
  return count;
}

function businessEvidence(state: WorldState, promotion: Promotion, events: WrestlingEvent[]): number {
  const completed = events.filter((event) => event.status === "COMPLETED").length;
  const cancelled = events.filter((event) => event.status === "CANCELLED").length;
  const decided = completed + cancelled;
  const reliability = decided > 0
    ? completed / decided * 100
    : promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED" ? 15 : 50;
  const restructuringPenalty = restructuringCountThisYear(state, promotion.id) * 8;
  const score = FINANCIAL_REPUTATION[promotion.financialDistress] * 0.48
    + reliability * 0.32
    + promotion.mediaReach * 0.2
    - restructuringPenalty;
  return round1(clamp(score));
}

function majorEventScore(events: WrestlingEvent[]): number {
  const majors = events.filter((event) => event.status === "COMPLETED" && event.type === "MAJOR");
  if (majors.length === 0) return 35;
  return round1(clamp(majors.reduce((sum, event) => {
    const matchQuality = clamp((event.averageMatchRating - 1) / 4 * 100);
    return sum + event.crowdResponse * 0.6 + matchQuality * 0.4;
  }, 0) / majors.length));
}

function championshipPrestige(state: WorldState, promotionId: string): number {
  const titles = (state.championships ?? []).filter((title) => title.promotionId === promotionId);
  if (titles.length === 0) return 30;
  return round1(titles.reduce((sum, title) => sum + title.prestige, 0) / titles.length);
}

function prestigeEvidence(
  state: WorldState,
  promotion: Promotion,
  events: WrestlingEvent[],
  fanScore: number,
): number {
  return round1(clamp(
    TIER_PRESTIGE[promotion.tier] * 0.3
      + championshipPrestige(state, promotion.id) * 0.25
      + majorEventScore(events) * 0.25
      + fanScore * 0.2,
  ));
}

export function processPromotionStandingForWeek(state: WorldState): void {
  const standings = ensurePromotionStandings(state);
  if (state.world.currentDate.week !== state.ruleset.weeksPerYear) return;

  const writer = new LedgerWriter(state.world.id, state.ledger);
  for (const promotion of state.promotions) {
    const standing = standings.find((entry) => entry.promotionId === promotion.id)!;
    if (standing.lastEvaluatedYear === state.world.currentDate.year) continue;

    const events = annualEvents(state, promotion.id);
    const fanScore = fanEvidence(state, promotion, events);
    const businessScore = businessEvidence(state, promotion, events);
    const prestigeScore = prestigeEvidence(state, promotion, events, fanScore);
    const previousPrestige = standing.prestige;
    const previousFan = standing.fanReputation;
    const previousBusiness = standing.businessReputation;

    standing.fanReputation = blend(standing.fanReputation, fanScore, 0.35);
    standing.businessReputation = blend(standing.businessReputation, businessScore, 0.3);
    standing.prestige = blend(
      standing.prestige,
      prestigeScore,
      prestigeScore >= standing.prestige ? 0.18 : 0.04,
    );
    standing.lastEvaluatedYear = state.world.currentDate.year;

    writer.append({
      date: state.world.currentDate,
      type: "PROMOTION_STANDING_UPDATED",
      significance: Math.abs(standing.prestige - previousPrestige) >= 5 ? "NOTABLE" : "ROUTINE",
      entityIds: [promotion.id],
      payload: {
        prestige: standing.prestige,
        fanReputation: standing.fanReputation,
        businessReputation: standing.businessReputation,
        prestigeDelta: round1(standing.prestige - previousPrestige),
        fanDelta: round1(standing.fanReputation - previousFan),
        businessDelta: round1(standing.businessReputation - previousBusiness),
      },
    });
  }
}
