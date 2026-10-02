declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  addPpwWeeks,
  advanceWeeks,
  buildOneOffTerms,
  expireContracts,
  canAcceptContractTerms,
  createSignedContract,
  createWorld,
  currentRosterPersonIds,
  deterministicWorldHash,
  determineFinancialDistress,
  DeterministicRng,
  resolveWorldWeek,
  resolveWorldWeeks,
  serviceCapacityDatesPerWeek,
  targetRosterSize,
  validateWorldInvariants,
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

test("same seed creates identical World", () => {
  const a = createWorld(42, DEFAULT_RULESET);
  const b = createWorld(42, DEFAULT_RULESET);
  equal(deterministicWorldHash(a), deterministicWorldHash(b));
});

test("different seeds create different Worlds", () => {
  const a = createWorld(42, DEFAULT_RULESET);
  const b = createWorld(43, DEFAULT_RULESET);
  ok(deterministicWorldHash(a) !== deterministicWorldHash(b), "different seeds produced identical snapshot hashes");
});

test("default Genesis creates expected entity counts", () => {
  const state = createWorld(101, DEFAULT_RULESET);
  equal(state.markets.length, 20);
  equal(state.promotions.length, 9);
  equal(state.people.length, 400);
});

test("Genesis creates formal contracts while preserving free-agent supply", () => {
  const state = createWorld(101, DEFAULT_RULESET);
  const contractedPeople = state.people.filter((person) => activeContractsForPerson(state, person.id).length > 0);
  equal(contractedPeople.length, 272);
  equal(state.contracts.length, 272);
  equal(state.people.length - contractedPeople.length, 128);
  ok((state.people.length - contractedPeople.length) / state.people.length >= 0.25, "labour market is too tightly contracted at Genesis");
});

test("Genesis roster distribution respects tier-scale targets instead of hoarding", () => {
  const state = createWorld(20261002, DEFAULT_RULESET);
  for (const promotion of state.promotions) {
    const size = currentRosterPersonIds(state, promotion.id).length;
    ok(Math.abs(size - targetRosterSize(promotion)) <= 1, `${promotion.tier} ${promotion.id} roster ${size} is too far from target ${targetRosterSize(promotion)}`);
  }
});

test("one Global promotion exists in default Genesis", () => {
  const state = createWorld(101, DEFAULT_RULESET);
  equal(state.promotions.filter((p) => p.tier === "GLOBAL").length, 1);
});

test("World advances across 52-week PPW Years", () => {
  const state = createWorld(7, DEFAULT_RULESET);
  advanceWeeks(state.world, state.ruleset.weeksPerYear, 52);
  equal(state.world.currentDate.year, 2);
  equal(state.world.currentDate.week, 1);
  advanceWeeks(state.world, state.ruleset.weeksPerYear, 468);
  equal(state.world.currentDate.year, 11);
  equal(state.world.currentDate.week, 1);
});

test("weekly finance settlement records contract guarantees instead of static roster payroll", () => {
  const state = createWorld(55, DEFAULT_RULESET);
  resolveWorldWeek(state);
  const guarantees = state.financialTransactions.filter((transaction) => transaction.category === "CONTRACT_GUARANTEE");
  const activeGuarantees = state.contracts.filter((contract) => contract.status === "SIGNED" && contract.weeklyGuarantee > 0);
  equal(guarantees.length, activeGuarantees.length);
  ok(!state.financialTransactions.some((transaction) => (transaction.category as string) === "TALENT_COMMITMENT"), "legacy talent commitment transaction survived contract migration");
});

test("weekly finance transactions reconcile exactly to promotion cash movement including contract bonuses", () => {
  const state = createWorld(56, DEFAULT_RULESET);
  const before = new Map(state.promotions.map((promotion) => [promotion.id, promotion.cash]));
  resolveWorldWeek(state);
  for (const promotion of state.promotions) {
    const transactionNet = state.financialTransactions
      .filter((transaction) => transaction.promotionId === promotion.id)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    equal(promotion.cash, before.get(promotion.id)! + transactionNet);
    equal(promotion.lastWeeklyNet, transactionNet);
  }
});

test("financial transaction IDs remain unique across weeks", () => {
  const state = createWorld(57, DEFAULT_RULESET);
  resolveWorldWeeks(state, 3);
  const ids = state.financialTransactions.map((transaction) => transaction.id);
  equal(new Set(ids).size, ids.length);
});

test("financial distress thresholds respond to runway", () => {
  equal(determineFinancialDistress(1_000_000, 1), "HEALTHY");
  equal(determineFinancialDistress(1_000_000, -40_000), "HEALTHY");
  equal(determineFinancialDistress(500_000, -40_000), "WATCH");
  equal(determineFinancialDistress(200_000, -40_000), "DISTRESSED");
  equal(determineFinancialDistress(50_000, -40_000), "CRISIS");
  equal(determineFinancialDistress(0, -1), "CRISIS");
});

test("service capacity allows compatible outside work and blocks impossible overload", () => {
  const state = createWorld(600, DEFAULT_RULESET);
  const person = state.people.find((candidate) => candidate.careerStage === "PRIME")!;
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT")!;
  const rng = new DeterministicRng(99);
  const oneOff = buildOneOffTerms(state, promotion, person, rng);
  ok(serviceCapacityDatesPerWeek(person) >= 1, "prime wrestler should be physically capable of a one-off date");
  const firstCheck = canAcceptContractTerms(state, person, oneOff);
  if (activeContractsForPerson(state, person.id).some((contract) => contract.exclusivity === "EXCLUSIVE")) {
    ok(!firstCheck.ok, "exclusive wrestler incorrectly accepted outside work");
  } else {
    ok(firstCheck.ok || firstCheck.reason === "service capacity exceeded", "unexpected contract rejection reason");
  }
});

test("one-off contracts exist as a real one-date contract family and expire cleanly", () => {
  const state = createWorld(602, DEFAULT_RULESET);
  const person = state.people.find((candidate) => activeContractsForPerson(state, candidate.id).length === 0)!;
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT")!;
  const terms = buildOneOffTerms(state, promotion, person, new DeterministicRng(101));
  const contract = createSignedContract(state, person, promotion, terms, null, false);
  equal(contract.family, "ONE_OFF");
  equal(contract.dateEntitlement, 1);
  equal(activeContractsForPerson(state, person.id).some((candidate) => candidate.id === contract.id), true);
  advanceWeeks(state.world, state.ruleset.weeksPerYear, 1);
  expireContracts(state);
  equal(contract.status, "EXPIRED");
});

test("exclusive contracts cannot overlap other signed contracts", () => {
  const state = createWorld(601, DEFAULT_RULESET);
  const person = state.people.find((candidate) => activeContractsForPerson(state, candidate.id).length === 0)!;
  const promotionA = state.promotions[0]!;
  const promotionB = state.promotions[1]!;
  const exclusive = {
    family: "EXCLUSIVE" as const,
    exclusivity: "EXCLUSIVE" as const,
    roleExpectation: "FEATURED" as const,
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 25, state.ruleset.weeksPerYear),
    dateEntitlement: 16,
    weeklyGuarantee: 50_000,
    appearanceFee: 0,
    signingBonus: 0,
  };
  createSignedContract(state, person, promotionA, exclusive, null, false);
  const check = canAcceptContractTerms(state, person, { ...exclusive, weeklyGuarantee: 60_000 });
  ok(!check.ok, "overlapping exclusive contract was accepted");
  ok(check.reason?.includes("exclusive") ?? false, "exclusive rejection did not explain the conflict");
  equal(activeContractsForPromotion(state, promotionB.id).filter((contract) => contract.personId === person.id).length, 0);
});

test("contract market creates offers, expiries and roster movement over time", () => {
  const state = createWorld(777, DEFAULT_RULESET);
  const initialContractIds = new Set(state.contracts.map((contract) => contract.id));
  resolveWorldWeeks(state, 80);
  ok(state.contractOffers.length > 0, "AI contract market generated no offers");
  ok(state.contractOffers.some((offer) => offer.status === "ACCEPTED"), "no contract offer was accepted");
  ok(state.contracts.some((contract) => !initialContractIds.has(contract.id)), "no new contracts were signed");
  ok(state.contracts.some((contract) => contract.status === "EXPIRED"), "no contracts expired");
});

test("non-exclusive careers can span multiple promotions", () => {
  const state = createWorld(778, DEFAULT_RULESET);
  resolveWorldWeeks(state, 160);
  const multi = state.people.filter((person) => new Set(activeContractsForPerson(state, person.id).map((contract) => contract.promotionId)).size > 1);
  ok(multi.length > 0, "no wrestler developed a multi-promotion non-exclusive career");
});

test("resolved Worlds remain deterministic", () => {
  const a = createWorld(1234, DEFAULT_RULESET);
  const b = createWorld(1234, DEFAULT_RULESET);
  resolveWorldWeeks(a, 104);
  resolveWorldWeeks(b, 104);
  equal(deterministicWorldHash(a), deterministicWorldHash(b));
});

test("Genesis and 520 resolved weeks satisfy core invariants", () => {
  const state = createWorld(999, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const errors = validateWorldInvariants(state);
  equal(errors.length, 0, errors.join("\n"));
});

test("Genesis creates venue bands and promotion-market state for every promotion/market pair", () => {
  const state = createWorld(404, DEFAULT_RULESET);
  equal(state.venues.length, state.markets.length * 3);
  equal(state.promotionMarketStates.length, state.promotions.length * state.markets.length);
  for (const market of state.markets) {
    equal(state.venues.filter((venue) => venue.marketId === market.id).length, 3);
  }
});

test("event cadence produces weekly top-tier shows and less frequent smaller-promotion shows", () => {
  const state = createWorld(405, DEFAULT_RULESET);
  resolveWorldWeeks(state, 2);
  const weekOne = state.events.filter((event) => event.date.year === 1 && event.date.week === 1);
  const weekTwo = state.events.filter((event) => event.date.year === 1 && event.date.week === 2);
  equal(weekOne.length, 9);
  equal(weekTwo.length, 3);
  ok(weekTwo.every((event) => {
    const promotion = state.promotions.find((candidate) => candidate.id === event.promotionId)!;
    return promotion.tier === "GLOBAL" || promotion.tier === "NATIONAL";
  }), "a slower-cadence promotion incorrectly ran in week two");
});

test("completed events respect venue capacity and create gate/venue/production transactions", () => {
  const state = createWorld(406, DEFAULT_RULESET);
  resolveWorldWeek(state);
  const completed = state.events.filter((event) => event.status === "COMPLETED");
  ok(completed.length > 0, "no events completed");
  for (const event of completed) {
    const venue = state.venues.find((candidate) => candidate.id === event.venueId)!;
    ok(event.attendance <= venue.capacity, `${event.id} exceeded venue capacity`);
    ok(event.gateRevenue >= 0, `${event.id} has negative gate`);
    equal(event.netResult, event.gateRevenue - event.totalCost);
    ok(state.financialTransactions.some((transaction) => transaction.category === "GATE_REVENUE" && transaction.source === event.id), `${event.id} missing gate transaction`);
    ok(state.financialTransactions.some((transaction) => transaction.category === "VENUE_COST" && transaction.source === event.id), `${event.id} missing venue transaction`);
    ok(state.financialTransactions.some((transaction) => transaction.category === "PRODUCTION_COST" && transaction.source === event.id), `${event.id} missing production transaction`);
  }
});

test("completed appearances consume purchased contract dates exactly once", () => {
  const state = createWorld(407, DEFAULT_RULESET);
  resolveWorldWeek(state);
  const completed = state.scheduledAppearances.filter((appearance) => appearance.status === "COMPLETED");
  ok(completed.length > 0, "no contracted appearances completed");
  const totalDatesUsed = state.contracts.reduce((sum, contract) => sum + contract.datesUsed, 0);
  equal(totalDatesUsed, completed.length);
  for (const appearance of completed) {
    const contract = state.contracts.find((candidate) => candidate.id === appearance.contractId)!;
    if (contract.appearanceFee > 0) {
      ok(state.financialTransactions.some((transaction) => transaction.category === "APPEARANCE_FEE" && transaction.source === appearance.id), `${appearance.id} missing appearance fee`);
    }
  }
});

test("live gate economy can generate both profitable and loss-making events", () => {
  const state = createWorld(20261002, DEFAULT_RULESET);
  resolveWorldWeeks(state, 52);
  const completed = state.events.filter((event) => event.status === "COMPLETED");
  ok(completed.some((event) => event.netResult > 0), "no live event ever made money");
  ok(completed.some((event) => event.netResult < 0), "all live events made money; venue/price risk is absent");
  const indieIds = new Set(state.promotions.filter((promotion) => promotion.tier === "INDEPENDENT").map((promotion) => promotion.id));
  ok(completed.some((event) => indieIds.has(event.promotionId) && event.netResult > 0), "Independent promotions never produced a profitable live event");
});

test("scheduled appearances never exceed same-day booking or weekly Service Capacity", () => {
  const state = createWorld(408, DEFAULT_RULESET);
  resolveWorldWeeks(state, 104);
  const errors = validateWorldInvariants(state).filter((error) => error.includes("double-booked") || error.includes("service capacity"));
  equal(errors.length, 0, errors.join("\n"));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
