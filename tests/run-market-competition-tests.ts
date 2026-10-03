declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WrestlingEvent } from "../packages/domain/src/types.js";
import { createWorld } from "../packages/sim-core/src/index.js";
import { competitionDemandFactor } from "../packages/sim-core/src/market-competition.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

function eventFor(
  state: ReturnType<typeof createWorld>,
  id: string,
  promotionId: string,
  marketId: string,
  day: number,
): WrestlingEvent {
  const venue = state.venues.find((entry) => entry.marketId === marketId)!;
  return {
    id,
    worldId: state.world.id,
    promotionId,
    marketId,
    venueId: venue.id,
    date: { ...state.world.currentDate, day },
    type: "REGULAR",
    status: "SCHEDULED",
    ticketStrategy: "STANDARD",
    expectedDemand: 1000,
    attendance: 0,
    ticketYield: 50,
    gateRevenue: 0,
    totalCost: 0,
    netResult: 0,
    eventImportance: 58,
    matchCount: 0,
    averageMatchRating: 0,
    bestMatchRating: 0,
    crowdResponse: 0,
  };
}

function setMarketPower(
  state: ReturnType<typeof createWorld>,
  promotionId: string,
  marketId: string,
  strength: number,
  mediaReach: number,
): void {
  const promotion = state.promotions.find((entry) => entry.id === promotionId)!;
  promotion.mediaReach = mediaReach;
  const local = state.promotionMarketStates.find(
    (entry) => entry.promotionId === promotionId && entry.marketId === marketId,
  )!;
  local.liveStrength = strength;
  local.awareness = strength;
  local.loyalty = strength;
}

test("a market with no rival event applies no competitive demand penalty", () => {
  const state = createWorld(10301, DEFAULT_RULESET);
  const targetPromotion = state.promotions[0]!;
  const marketId = targetPromotion.homeMarketId;
  const target = eventFor(state, "competition-target", targetPromotion.id, marketId, 4);
  const factor = competitionDemandFactor(state, target, [target]);
  ok(factor === 1, `expected no-rival factor 1, got ${factor}`);
});

test("a strong local rival suppresses demand materially more than a weak rival", () => {
  const strongState = createWorld(10302, DEFAULT_RULESET);
  const weakState = createWorld(10302, DEFAULT_RULESET);
  const targetPromotionId = strongState.promotions[3]!.id;
  const rivalPromotionId = strongState.promotions[0]!.id;
  const marketId = strongState.promotions[3]!.homeMarketId;

  setMarketPower(strongState, targetPromotionId, marketId, 55, 55);
  setMarketPower(weakState, targetPromotionId, marketId, 55, 55);
  setMarketPower(strongState, rivalPromotionId, marketId, 92, 92);
  setMarketPower(weakState, rivalPromotionId, marketId, 15, 15);

  const strongTarget = eventFor(strongState, "strong-target", targetPromotionId, marketId, 4);
  const strongRival = eventFor(strongState, "strong-rival", rivalPromotionId, marketId, 4);
  const weakTarget = eventFor(weakState, "weak-target", targetPromotionId, marketId, 4);
  const weakRival = eventFor(weakState, "weak-rival", rivalPromotionId, marketId, 4);

  const strongFactor = competitionDemandFactor(strongState, strongTarget, [strongTarget, strongRival]);
  const weakFactor = competitionDemandFactor(weakState, weakTarget, [weakTarget, weakRival]);
  console.log(`  rival pressure: strong ${strongFactor.toFixed(3)} vs weak ${weakFactor.toFixed(3)}`);
  ok(strongFactor < weakFactor - 0.08, `strong rival ${strongFactor} was not materially more damaging than weak rival ${weakFactor}`);
  ok(strongFactor > 0.7, `single strong rival penalty was too severe: ${strongFactor}`);
});

test("same-day competition matters more than events spaced across the PPW week", () => {
  const state = createWorld(10303, DEFAULT_RULESET);
  const targetPromotionId = state.promotions[3]!.id;
  const rivalPromotionId = state.promotions[1]!.id;
  const marketId = state.promotions[3]!.homeMarketId;
  setMarketPower(state, targetPromotionId, marketId, 55, 55);
  setMarketPower(state, rivalPromotionId, marketId, 75, 75);

  const target = eventFor(state, "spacing-target", targetPromotionId, marketId, 2);
  const sameDay = eventFor(state, "spacing-rival-same", rivalPromotionId, marketId, 2);
  const farDay = eventFor(state, "spacing-rival-far", rivalPromotionId, marketId, 7);
  const sameDayFactor = competitionDemandFactor(state, target, [target, sameDay]);
  const farDayFactor = competitionDemandFactor(state, target, [target, farDay]);
  ok(sameDayFactor < farDayFactor, `same-day factor ${sameDayFactor} should be below spaced factor ${farDayFactor}`);
  ok(farDayFactor > 0.85, `spaced weekly competition remained too punitive: ${farDayFactor}`);
});

console.log(`\nMarket competition tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
