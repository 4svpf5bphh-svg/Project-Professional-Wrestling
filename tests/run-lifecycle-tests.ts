declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPromotion,
  createWorld,
  minimumViableRoster,
  processPromotionSurvivalForWeek,
  resolveWorldWeeks,
  survivalStateForPromotion,
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

function equal<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) throw new Error(message ?? `expected ${String(expected)}, received ${String(actual)}`);
}

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

test("survival state is lazily initialized from promotion baselines", () => {
  const state = createWorld(7001, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT")!;
  const survival = survivalStateForPromotion(state, promotion.id);
  equal(survival.baselineWeeklyFixedOverhead, promotion.weeklyFixedOverhead);
  equal(survival.baselineEventCadenceWeeks, promotion.eventCadenceWeeks);
  equal(survival.restructuringCount, 0);
});

test("sustained distress triggers restructuring and lower operating scale", () => {
  const state = createWorld(7002, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT")!;
  const survival = survivalStateForPromotion(state, promotion.id);
  const baselineOverhead = promotion.weeklyFixedOverhead;
  const baselineCadence = promotion.eventCadenceWeeks;
  promotion.financialDistress = "DISTRESSED";
  survival.stressWeeks = state.ruleset.survivalDistressThresholdWeeks - state.ruleset.survivalEvaluationIntervalWeeks;
  processPromotionSurvivalForWeek(state);
  equal(promotion.lifecycle, "DISTRESSED");
  ok(promotion.weeklyFixedOverhead < baselineOverhead, "restructuring did not reduce overhead");
  ok(promotion.eventCadenceWeeks >= baselineCadence, "restructuring increased event frequency");
  equal(survival.restructuringCount, 1);
  ok(state.ledger.some((event) => event.type === "PROMOTION_RESTRUCTURED" && event.entityIds.includes(promotion.id)), "restructuring was not recorded in history");
});

test("distressed understaffed promotions can sign cheap emergency free agents", () => {
  const state = createWorld(7003, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT")!;
  for (const contract of activeContractsForPromotion(state, promotion.id)) contract.status = "TERMINATED";
  const survival = survivalStateForPromotion(state, promotion.id);
  promotion.financialDistress = "DISTRESSED";
  survival.stressWeeks = state.ruleset.survivalDistressThresholdWeeks - state.ruleset.survivalEvaluationIntervalWeeks;
  equal(activeContractsForPromotion(state, promotion.id).length, 0);
  processPromotionSurvivalForWeek(state);
  ok(activeContractsForPromotion(state, promotion.id).length > 0, "emergency recruitment signed nobody");
  ok(state.ledger.some((event) => event.type === "EMERGENCY_TALENT_SIGNED" && event.entityIds.includes(promotion.id)), "emergency signing was not recorded");
});

test("healthy distressed promotions recover to their baseline operating scale", () => {
  const state = createWorld(7004, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT")!;
  const survival = survivalStateForPromotion(state, promotion.id);
  promotion.lifecycle = "DISTRESSED";
  promotion.financialDistress = "HEALTHY";
  promotion.weeklyFixedOverhead = Math.round(survival.baselineWeeklyFixedOverhead * 0.68);
  promotion.eventCadenceWeeks = survival.baselineEventCadenceWeeks + 1;
  survival.healthyWeeks = state.ruleset.survivalRecoveryWeeks - state.ruleset.survivalEvaluationIntervalWeeks;
  processPromotionSurvivalForWeek(state);
  equal(promotion.lifecycle, "ACTIVE");
  equal(promotion.weeklyFixedOverhead, survival.baselineWeeklyFixedOverhead);
  equal(promotion.eventCadenceWeeks, survival.baselineEventCadenceWeeks);
  ok(state.ledger.some((event) => event.type === "PROMOTION_RECOVERED_FROM_DISTRESS" && event.entityIds.includes(promotion.id)), "recovery was not recorded");
});

test("prolonged insolvent understaffing enters Dormancy and stops operating", () => {
  const state = createWorld(7005, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT")!;
  for (const contract of activeContractsForPromotion(state, promotion.id)) contract.status = "TERMINATED";
  const survival = survivalStateForPromotion(state, promotion.id);
  promotion.financialDistress = "CRISIS";
  promotion.cash = -500_000;
  survival.stressWeeks = state.ruleset.survivalDistressThresholdWeeks;
  survival.crisisWeeks = state.ruleset.survivalCrisisDormancyWeeks - state.ruleset.survivalEvaluationIntervalWeeks;
  survival.understaffedWeeks = state.ruleset.survivalUnderstaffedDormancyWeeks - state.ruleset.survivalEvaluationIntervalWeeks;
  survival.lastRestructureWeekIndex = 0;
  processPromotionSurvivalForWeek(state);
  equal(promotion.lifecycle, "DORMANT");
  equal(activeContractsForPromotion(state, promotion.id).length, 0);
  ok(state.ledger.some((event) => event.type === "PROMOTION_ENTERED_DORMANCY" && event.entityIds.includes(promotion.id)), "Dormancy was not recorded");

  const eventCount = state.events.filter((event) => event.promotionId === promotion.id).length;
  const transactionCount = state.financialTransactions.filter((transaction) => transaction.promotionId === promotion.id).length;
  resolveWorldWeeks(state, 8);
  equal(state.events.filter((event) => event.promotionId === promotion.id).length, eventCount, "Dormant promotion kept scheduling events");
  equal(state.financialTransactions.filter((transaction) => transaction.promotionId === promotion.id).length, transactionCount, "Dormant promotion kept generating operating transactions");
});

test("minimum viable roster never falls below event legality", () => {
  const state = createWorld(7006, DEFAULT_RULESET);
  for (const promotion of state.promotions) {
    ok(minimumViableRoster(state, promotion) >= state.ruleset.minEventParticipants, `${promotion.id} viable roster fell below legal event minimum`);
  }
});

console.log(`\nLifecycle tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
