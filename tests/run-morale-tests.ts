declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { Contract, Person, Promotion, WorldState } from "../packages/domain/src/types.js";
import {
  activeContractsForPromotion,
  createWorld,
  processWrestlerMoraleForWeek,
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

function addCompletedShow(state: WorldState, promotion: Promotion, used?: { person: Person; contract: Contract }): void {
  const venue = state.venues.find((candidate) => candidate.marketId === promotion.homeMarketId) ?? state.venues[0]!;
  const eventId = `morale-event-${state.events.length + 1}`;
  state.events.push({
    id: eventId,
    worldId: state.world.id,
    promotionId: promotion.id,
    marketId: promotion.homeMarketId,
    venueId: venue.id,
    date: { ...state.world.currentDate },
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 1000,
    attendance: 1000,
    ticketYield: 25,
    gateRevenue: 25_000,
    totalCost: 20_000,
    netResult: 5_000,
    eventImportance: 50,
    matchCount: 0,
    averageMatchRating: 0,
    bestMatchRating: 0,
    crowdResponse: 60,
  });
  if (used) {
    state.scheduledAppearances.push({
      id: `morale-appearance-${state.scheduledAppearances.length + 1}`,
      worldId: state.world.id,
      eventId,
      promotionId: promotion.id,
      personId: used.person.id,
      contractId: used.contract.id,
      date: { ...state.world.currentDate },
      serviceCapacityAtBooking: 100,
      status: "COMPLETED",
    });
  }
}

test("being used lifts morale while clear contractual underuse lowers it", () => {
  const state = createWorld(10501, DEFAULT_RULESET);
  const promotion = state.promotions[0]!;
  const contracts = activeContractsForPromotion(state, promotion.id);
  const usedContract = contracts[0]!;
  const unusedContract = contracts[1]!;
  const used = state.people.find((person) => person.id === usedContract.personId)!;
  const unused = state.people.find((person) => person.id === unusedContract.personId)!;
  usedContract.roleExpectation = "MAIN_EVENT";
  unusedContract.roleExpectation = "MAIN_EVENT";
  used.morale = 60;
  unused.morale = 60;
  used.momentum = unused.momentum = 50;
  used.fatigue = unused.fatigue = 0;

  addCompletedShow(state, promotion, { person: used, contract: usedContract });
  processWrestlerMoraleForWeek(state);
  console.log(`  usage morale: used ${used.morale}, unused ${unused.morale}`);
  ok(used.morale > 60, `used wrestler did not gain morale: ${used.morale}`);
  ok(unused.morale < 58, `unused main-event wrestler did not lose enough morale: ${unused.morale}`);
  ok(used.morale >= unused.morale + 5, `usage did not create meaningful morale separation: ${used.morale} vs ${unused.morale}`);
});

test("fatigue and promotion crisis materially depress current morale", () => {
  const healthy = createWorld(10502, DEFAULT_RULESET);
  const stressed = createWorld(10502, DEFAULT_RULESET);
  const healthyPromotion = healthy.promotions[0]!;
  const stressedPromotion = stressed.promotions[0]!;
  const healthyContract = activeContractsForPromotion(healthy, healthyPromotion.id)[0]!;
  const stressedContract = activeContractsForPromotion(stressed, stressedPromotion.id)[0]!;
  const healthyPerson = healthy.people.find((person) => person.id === healthyContract.personId)!;
  const stressedPerson = stressed.people.find((person) => person.id === stressedContract.personId)!;
  healthyPerson.morale = stressedPerson.morale = 60;
  healthyPerson.momentum = stressedPerson.momentum = 50;
  healthyPerson.fatigue = 0;
  stressedPerson.fatigue = 85;
  stressedPromotion.financialDistress = "CRISIS";

  addCompletedShow(healthy, healthyPromotion, { person: healthyPerson, contract: healthyContract });
  addCompletedShow(stressed, stressedPromotion, { person: stressedPerson, contract: stressedContract });
  processWrestlerMoraleForWeek(healthy);
  processWrestlerMoraleForWeek(stressed);
  console.log(`  pressure morale: healthy ${healthyPerson.morale}, stressed ${stressedPerson.morale}`);
  ok(healthyPerson.morale >= stressedPerson.morale + 4, `fatigue/crisis pressure was too weak: ${healthyPerson.morale} vs ${stressedPerson.morale}`);
  ok(stressedPerson.morale < 60, `stressed wrestler morale did not fall: ${stressedPerson.morale}`);
});

test("free-agent morale drifts gently rather than collapsing without bookings", () => {
  const state = createWorld(10503, DEFAULT_RULESET);
  const contractedIds = new Set(state.contracts.filter((contract) => contract.status === "SIGNED").map((contract) => contract.personId));
  const freeAgent = state.people.find((person) => !contractedIds.has(person.id))!;
  ok(Boolean(freeAgent), "expected at least one Genesis free agent");
  freeAgent.morale = 90;
  freeAgent.momentum = 50;
  freeAgent.fatigue = 0;
  processWrestlerMoraleForWeek(state);
  console.log(`  free-agent drift: 90 -> ${freeAgent.morale}`);
  ok(freeAgent.morale < 90, "free-agent morale did not drift toward neutral");
  ok(freeAgent.morale > 85, `free-agent morale moved too aggressively in one quiet week: ${freeAgent.morale}`);
});

test("a decade produces bounded differentiated deterministic morale", () => {
  const stateA = createWorld(20261002, DEFAULT_RULESET);
  const stateB = createWorld(20261002, DEFAULT_RULESET);
  resolveWorldWeeks(stateA, 520);
  resolveWorldWeeks(stateB, 520);
  const values = stateA.people.filter((person) => person.status !== "RETIRED").map((person) => person.morale);
  const valuesB = stateB.people.filter((person) => person.status !== "RETIRED").map((person) => person.morale);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const average = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  console.log(`  decade morale: avg ${average.toFixed(1)}, range ${range.toFixed(1)}, min ${min.toFixed(1)}, max ${max.toFixed(1)}`);
  ok(values.every((value) => value >= 5 && value <= 95), "morale escaped its 5-95 bounds");
  ok(range >= 12, `morale remained too homogeneous after a decade: ${range}`);
  ok(range <= 70, `morale became implausibly polarized after a decade: ${range}`);
  ok(average >= 35 && average <= 80, `decade average morale is implausible: ${average}`);
  ok(JSON.stringify(values) === JSON.stringify(valuesB), "morale is not deterministic for the same World seed");
});

console.log(`\nMorale tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
