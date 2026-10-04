declare const process: { exitCode?: number };

import {
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldEngagementState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  executeStewardshipRivalBuyout,
  joinPlayerToWorld,
  recordPlayerActivity,
  stewardshipBuyoutQuote,
  type ApplicationWorldAggregate,
  type StewardshipBuyoutPlan,
  type StewardshipExitRequest,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  addPpwWeeks,
  createWorld,
  marketWeeklyValue,
  weeksBetween,
} from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
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

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function expectThrow(fn: () => void, includes: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(includes)) throw new Error(`expected error containing ${includes}, got: ${message}`);
    return;
  }
  throw new Error(`expected error containing ${includes}`);
}

function fixture(seed: number): {
  aggregate: ApplicationWorldAggregate;
  playerId: string;
  sellerPromotionId: string;
  buyerPromotionId: string;
  personId: string;
  contractId: string;
  requestId: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const playerId = "inactive-owner";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);

  const seller = state.promotions.find((promotion) => (
    promotion.controllerType === "AI"
    && promotion.tier === "INDEPENDENT"
    && promotion.lifecycle === "ACTIVE"
    && activeContractsForPromotion(state, promotion.id).some((contract) => (
      contract.family !== "ONE_OFF"
      && activeContractsForPerson(state, contract.personId).length === 1
    ))
  ));
  if (!seller) throw new Error("buyout fixture could not find an Independent seller with a transferable contract");
  claimIndependentPromotionForPlayer(state, ownership, playerId, seller.id);

  const contract = activeContractsForPromotion(state, seller.id).find((candidate) => (
    candidate.family !== "ONE_OFF" && activeContractsForPerson(state, candidate.personId).length === 1
  ));
  if (!contract) throw new Error("buyout fixture lost its source contract");

  const buyer = state.promotions
    .filter((promotion) => promotion.id !== seller.id && promotion.lifecycle === "ACTIVE")
    .sort((a, b) => {
      const tierScore = { GLOBAL: 5, NATIONAL: 4, RISING: 3, INDEPENDENT: 2, LOCAL: 1 } as const;
      return tierScore[b.tier] - tierScore[a.tier] || b.mediaReach - a.mediaReach || a.id.localeCompare(b.id);
    })[0];
  if (!buyer) throw new Error("buyout fixture could not find a rival buyer");
  buyer.cash = 100_000_000;

  const engagement = createWorldEngagementState(state.world.id);
  recordPlayerActivity(engagement, playerId, state.world.currentDate, 0, "2026-09-01");
  const activity = engagement.playerActivity.find((record) => record.playerId === playerId);
  if (!activity) throw new Error("buyout fixture lost player activity");
  activity.status = "STEWARDED";
  activity.statusSinceCycleKey = "2026-09-15";

  const requestId = `stewardship-exit:${contract.id}:2026-10-01`;
  const request: StewardshipExitRequest = {
    requestId,
    worldId: state.world.id,
    promotionId: seller.id,
    personId: contract.personId,
    contractId: contract.id,
    requestedDate: { ...state.world.currentDate },
    requestedCycleKey: "2026-10-01",
    trustAtRequest: 35,
    status: "OPEN",
  };
  engagement.stewardshipExitRequests.push(request);

  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning: createWorldPlanningState(state.world.id),
      engagement,
    },
    playerId,
    sellerPromotionId: seller.id,
    buyerPromotionId: buyer.id,
    personId: contract.personId,
    contractId: contract.id,
    requestId,
  };
}

function strongReplacementPlan(f: ReturnType<typeof fixture>): StewardshipBuyoutPlan {
  const person = f.aggregate.state.people.find((candidate) => candidate.id === f.personId)!;
  const market = marketWeeklyValue(person);
  return {
    requestId: f.requestId,
    buyerPromotionId: f.buyerPromotionId,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "MAIN_EVENT",
    startDate: { ...f.aggregate.state.world.currentDate },
    endDate: addPpwWeeks(f.aggregate.state.world.currentDate, 12, f.aggregate.state.ruleset.weeksPerYear),
    dateEntitlement: 6,
    weeklyGuarantee: market * 3,
    appearanceFee: market * 2,
    signingBonus: market * 4,
  };
}

await test("rival buyout enforces a seven-day notice window and quotes remaining nominal contract value", () => {
  const f = fixture(18301);
  expectThrow(
    () => stewardshipBuyoutQuote(f.aggregate, f.requestId, f.buyerPromotionId, "2026-10-07"),
    "1 day(s) remaining",
  );

  const quote = stewardshipBuyoutQuote(f.aggregate, f.requestId, f.buyerPromotionId, "2026-10-08");
  const contract = f.aggregate.state.contracts.find((candidate) => candidate.id === f.contractId)!;
  const expectedWeeks = Math.max(0, weeksBetween(
    f.aggregate.state.world.currentDate,
    contract.endDate,
    f.aggregate.state.ruleset.weeksPerYear,
  ) + 1);
  const expectedDates = Math.max(0, contract.dateEntitlement - contract.datesUsed);
  equal(quote.noticeDaysElapsed, 7, "notice elapsed days mismatch");
  equal(quote.remainingGuaranteeWeeks, expectedWeeks, "remaining guarantee weeks mismatch");
  equal(quote.remainingAppearanceDates, expectedDates, "remaining appearance dates mismatch");
  equal(
    quote.buyoutValue,
    contract.weeklyGuarantee * expectedWeeks + contract.appearanceFee * expectedDates,
    "remaining contract value mismatch",
  );
});

await test("rival buyout transfers value, records wrestler consent and signs the replacement contract exactly once", () => {
  const f = fixture(18302);
  const plan = strongReplacementPlan(f);
  const quote = stewardshipBuyoutQuote(f.aggregate, f.requestId, f.buyerPromotionId, "2026-10-08");
  const seller = f.aggregate.state.promotions.find((candidate) => candidate.id === f.sellerPromotionId)!;
  const buyer = f.aggregate.state.promotions.find((candidate) => candidate.id === f.buyerPromotionId)!;
  const sellerCashBefore = seller.cash;
  const buyerCashBefore = buyer.cash;

  const result = executeStewardshipRivalBuyout(f.aggregate, plan, "2026-10-08");
  ok(!result.alreadyExecuted, "first buyout execution was marked as retry");
  equal(result.buyoutValue, quote.buyoutValue, "executed buyout value changed from quote");
  ok(result.replacementUtility >= f.aggregate.state.ruleset.offerAcceptanceThreshold, "replacement terms were signed without wrestler consent threshold");
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "TERMINATED", "source contract was not terminated");

  const replacement = f.aggregate.state.contracts.find((contract) => contract.id === result.replacementContractId);
  ok(replacement, "replacement contract was not created");
  equal(replacement?.promotionId, f.buyerPromotionId, "replacement contract belongs to wrong buyer");
  equal(replacement?.personId, f.personId, "replacement contract belongs to wrong wrestler");
  equal(replacement?.sourceOfferId, result.acceptedOfferId, "replacement contract was not linked to accepted buyout offer");
  equal(f.aggregate.state.contractOffers.find((offer) => offer.id === result.acceptedOfferId)?.status, "ACCEPTED", "buyout replacement offer was not recorded as accepted");

  equal(seller.cash, sellerCashBefore + quote.buyoutValue, "seller did not receive buyout value");
  equal(buyer.cash, buyerCashBefore - quote.buyoutValue - plan.signingBonus, "buyer immediate cash cost mismatch");
  equal(
    f.aggregate.state.financialTransactions.filter((entry) => entry.category === "CONTRACT_BUYOUT" && entry.source === f.requestId).length,
    quote.buyoutValue > 0 ? 2 : 0,
    "buyout transfer did not create the expected finance entries",
  );
  equal(f.aggregate.engagement?.stewardshipExitRequests[0]?.status, "SETTLED", "buyout did not settle the release request");

  const cashAfter = { seller: seller.cash, buyer: buyer.cash };
  const contractCountAfter = f.aggregate.state.contracts.length;
  const retry = executeStewardshipRivalBuyout(f.aggregate, plan, "2026-10-08");
  ok(retry.alreadyExecuted, "duplicate buyout delivery was not idempotent");
  equal(seller.cash, cashAfter.seller, "retry paid seller twice");
  equal(buyer.cash, cashAfter.buyer, "retry charged buyer twice");
  equal(f.aggregate.state.contracts.length, contractCountAfter, "retry created a second replacement contract");
});

await test("returning owner closes the rival buyout route", () => {
  const f = fixture(18303);
  recordPlayerActivity(
    f.aggregate.engagement!,
    f.playerId,
    f.aggregate.state.world.currentDate,
    f.aggregate.runtime.revision,
    "2026-10-08",
  );
  expectThrow(
    () => stewardshipBuyoutQuote(f.aggregate, f.requestId, f.buyerPromotionId, "2026-10-08"),
    "unavailable once the seller owner is active again",
  );
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "SIGNED", "blocked buyout changed source contract");
});

await test("wrestler rejection leaves the Stewardship source contract untouched", () => {
  const f = fixture(18304);
  const plan = strongReplacementPlan(f);
  plan.weeklyGuarantee = 0;
  plan.appearanceFee = 0;
  plan.signingBonus = 0;
  plan.roleExpectation = "DEVELOPMENTAL";
  f.aggregate.state.ruleset.offerAcceptanceThreshold = 100;
  const seller = f.aggregate.state.promotions.find((candidate) => candidate.id === f.sellerPromotionId)!;
  const buyer = f.aggregate.state.promotions.find((candidate) => candidate.id === f.buyerPromotionId)!;
  const cashBefore = { seller: seller.cash, buyer: buyer.cash };

  expectThrow(
    () => executeStewardshipRivalBuyout(f.aggregate, plan, "2026-10-08"),
    "wrestler rejected",
  );
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "SIGNED", "rejected buyout terminated source contract");
  equal(f.aggregate.engagement?.stewardshipExitRequests[0]?.status, "OPEN", "rejected buyout settled the request");
  equal(seller.cash, cashBefore.seller, "rejected buyout changed seller cash");
  equal(buyer.cash, cashBefore.buyer, "rejected buyout changed buyer cash");
});

console.log(`\nStewardship buyout tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
