declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPromotion,
  applyHumanPromotionRestructure,
  claimIndependentPromotionForHuman,
  createWorld,
  humanPromotionSurvivalAction,
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

function humanIndependentFixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionForHuman(state, promotion.id, { name: "Player Wrestling" });
  return { state, promotion };
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

test("human promotion accumulates the same distress state and exposes a restructuring action", () => {
  const { state, promotion } = humanIndependentFixture(7007);
  const survival = survivalStateForPromotion(state, promotion.id);
  const baselineOverhead = promotion.weeklyFixedOverhead;
  promotion.financialDistress = "DISTRESSED";
  survival.stressWeeks = state.ruleset.survivalDistressThresholdWeeks - state.ruleset.survivalEvaluationIntervalWeeks;

  processPromotionSurvivalForWeek(state);

  equal(promotion.controllerType, "HUMAN", "survival evaluation changed human ownership");
  equal(promotion.lifecycle, "DISTRESSED", "human promotion did not enter objective distress lifecycle state");
  equal(survival.restructuringCount, 0, "human promotion was automatically restructured without a player decision");
  equal(promotion.weeklyFixedOverhead, baselineOverhead, "human overhead changed before restructuring was chosen");
  const action = humanPromotionSurvivalAction(state, promotion.id);
  ok(action?.kind === "RESTRUCTURE_REQUIRED", "human promotion did not expose the required survival action");
  equal(action!.stressWeeks, state.ruleset.survivalDistressThresholdWeeks);
});

test("human restructuring uses the same survival mechanics without changing ownership", () => {
  const { state, promotion } = humanIndependentFixture(7008);
  const survival = survivalStateForPromotion(state, promotion.id);
  const baselineOverhead = promotion.weeklyFixedOverhead;
  const baselineCadence = promotion.eventCadenceWeeks;
  promotion.financialDistress = "DISTRESSED";
  survival.stressWeeks = state.ruleset.survivalDistressThresholdWeeks;

  applyHumanPromotionRestructure(state, promotion.id);

  equal(promotion.controllerType, "HUMAN", "restructuring changed human ownership");
  equal(promotion.lifecycle, "DISTRESSED");
  ok(promotion.weeklyFixedOverhead < baselineOverhead, "human restructuring did not reduce overhead");
  ok(promotion.eventCadenceWeeks >= baselineCadence, "human restructuring unexpectedly increased show frequency");
  equal(survival.restructuringCount, 1);
  ok(humanPromotionSurvivalAction(state, promotion.id) === null, "completed restructuring remained immediately due");
  ok(state.ledger.some((event) => event.type === "PROMOTION_RESTRUCTURED" && event.entityIds.includes(promotion.id)), "human restructuring was not recorded");
});

test("ignored human crisis can still force corporate Dormancy without removing player control", () => {
  const { state, promotion } = humanIndependentFixture(7009);
  for (const contract of activeContractsForPromotion(state, promotion.id)) contract.status = "TERMINATED";
  const survival = survivalStateForPromotion(state, promotion.id);
  promotion.financialDistress = "CRISIS";
  promotion.cash = -500_000;
  survival.stressWeeks = state.ruleset.survivalDistressThresholdWeeks;
  survival.crisisWeeks = state.ruleset.survivalCrisisDormancyWeeks - state.ruleset.survivalEvaluationIntervalWeeks;
  survival.understaffedWeeks = state.ruleset.survivalUnderstaffedDormancyWeeks - state.ruleset.survivalEvaluationIntervalWeeks;

  processPromotionSurvivalForWeek(state);

  equal(promotion.lifecycle, "DORMANT", "human promotion received immunity from Dormancy");
  equal(promotion.controllerType, "HUMAN", "Dormancy silently removed player control");
  equal(activeContractsForPromotion(state, promotion.id).length, 0);
  ok(humanPromotionSurvivalAction(state, promotion.id) === null, "Dormant company still exposed a restructuring action");
});

test("healthy human promotion recovers under the same objective recovery threshold", () => {
  const { state, promotion } = humanIndependentFixture(7010);
  const survival = survivalStateForPromotion(state, promotion.id);
  promotion.lifecycle = "DISTRESSED";
  promotion.financialDistress = "HEALTHY";
  promotion.weeklyFixedOverhead = Math.round(survival.baselineWeeklyFixedOverhead * 0.68);
  promotion.eventCadenceWeeks = survival.baselineEventCadenceWeeks + 1;
  survival.healthyWeeks = state.ruleset.survivalRecoveryWeeks - state.ruleset.survivalEvaluationIntervalWeeks;

  processPromotionSurvivalForWeek(state);

  equal(promotion.lifecycle, "ACTIVE");
  equal(promotion.controllerType, "HUMAN");
  equal(promotion.weeklyFixedOverhead, survival.baselineWeeklyFixedOverhead);
  equal(promotion.eventCadenceWeeks, survival.baselineEventCadenceWeeks);
});

console.log(`\nLifecycle tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
