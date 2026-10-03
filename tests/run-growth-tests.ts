declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  createWorld,
  processPromotionTierGrowthForWeek,
  promotionScaleScore,
  resolveWorldWeeks,
} from "../packages/sim-core/src/index.js";

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

function forceStrongScale(state: ReturnType<typeof createWorld>, promotionId: string): void {
  const promotion = state.promotions.find((entry) => entry.id === promotionId)!;
  promotion.mediaReach = 92;
  promotion.financialDistress = "HEALTHY";
  for (const local of state.promotionMarketStates) {
    if (local.promotionId !== promotionId) continue;
    local.awareness = 90;
    local.liveStrength = 90;
    local.loyalty = 86;
  }
}

function forceWeakScale(state: ReturnType<typeof createWorld>, promotionId: string): void {
  const promotion = state.promotions.find((entry) => entry.id === promotionId)!;
  promotion.mediaReach = 5;
  promotion.financialDistress = "CRISIS";
  for (const local of state.promotionMarketStates) {
    if (local.promotionId !== promotionId) continue;
    local.awareness = 5;
    local.liveStrength = 4;
    local.loyalty = 5;
  }
}

test("annual scale score reflects genuine audience and business strength", () => {
  const strong = createWorld(10201, DEFAULT_RULESET);
  const weak = createWorld(10201, DEFAULT_RULESET);
  const strongPromotion = strong.promotions[3]!;
  const weakPromotion = weak.promotions[3]!;
  forceStrongScale(strong, strongPromotion.id);
  forceWeakScale(weak, weakPromotion.id);
  const strongScore = promotionScaleScore(strong, strongPromotion);
  const weakScore = promotionScaleScore(weak, weakPromotion);
  ok(strongScore >= 75, `strong scale score too low: ${strongScore}`);
  ok(weakScore <= 30, `weak scale score too high: ${weakScore}`);
  ok(strongScore - weakScore >= 40, `scale model does not sufficiently separate strong and weak promotions: ${strongScore} vs ${weakScore}`);
});

test("strong promotions can rise only one tier at the annual boundary", () => {
  const state = createWorld(10202, DEFAULT_RULESET);
  const promotion = state.promotions[3]!;
  promotion.tier = "RISING";
  promotion.eventCadenceWeeks = 2;
  state.world.currentDate.week = DEFAULT_RULESET.weeksPerYear;
  forceStrongScale(state, promotion.id);
  processPromotionTierGrowthForWeek(state);
  const resultingTier: string = promotion.tier;
  ok(resultingTier === "NATIONAL", `expected one-step promotion to NATIONAL, got ${promotion.tier}`);
  ok(promotion.eventCadenceWeeks === 1, `expected national cadence of 1 week, got ${promotion.eventCadenceWeeks}`);
  const ledger = state.ledger.find((entry) => entry.type === "PROMOTION_TIER_CHANGED" && entry.entityIds.includes(promotion.id));
  ok(ledger, "expected tier change to be recorded in history");
});

test("collapsed promotions can fall only one tier at the annual boundary", () => {
  const state = createWorld(10203, DEFAULT_RULESET);
  const promotion = state.promotions[1]!;
  promotion.tier = "NATIONAL";
  promotion.eventCadenceWeeks = 1;
  state.world.currentDate.week = DEFAULT_RULESET.weeksPerYear;
  forceWeakScale(state, promotion.id);
  processPromotionTierGrowthForWeek(state);
  const resultingTier: string = promotion.tier;
  ok(resultingTier === "RISING", `expected one-step demotion to RISING, got ${promotion.tier}`);
  ok(promotion.eventCadenceWeeks === 2, `expected rising cadence of 2 weeks, got ${promotion.eventCadenceWeeks}`);
});

test("tier evaluation does not fire outside the annual boundary", () => {
  const state = createWorld(10204, DEFAULT_RULESET);
  const promotion = state.promotions[3]!;
  promotion.tier = "RISING";
  state.world.currentDate.week = 26;
  forceStrongScale(state, promotion.id);
  processPromotionTierGrowthForWeek(state);
  ok(promotion.tier === "RISING", `tier changed outside Week 52: ${promotion.tier}`);
  ok(!state.ledger.some((entry) => entry.type === "PROMOTION_TIER_CHANGED"), "tier history was written outside Week 52");
});

test("a decade produces bounded organic tier mobility rather than a frozen or yo-yo world", () => {
  const state = createWorld(20261002, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const changes = state.ledger.filter((entry) => entry.type === "PROMOTION_TIER_CHANGED");
  const byPromotion = new Map<string, number>();
  for (const entry of changes) {
    const promotionId = entry.entityIds[0]!;
    byPromotion.set(promotionId, (byPromotion.get(promotionId) ?? 0) + 1);
  }
  const maxChanges = Math.max(0, ...byPromotion.values());
  console.log(`  tier mobility: ${changes.length} changes across ${byPromotion.size} promotions; max ${maxChanges} for one promotion`);
  ok(changes.length >= 2, `world was effectively frozen with only ${changes.length} tier changes`);
  ok(changes.length <= 36, `world tiers were too volatile with ${changes.length} changes`);
  ok(maxChanges <= 6, `one promotion yo-yoed too often with ${maxChanges} tier changes`);
});

console.log(`\nGrowth tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
