declare const process: { exitCode?: number };

import {
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldEngagementState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  recordPlayerActivity,
  resolveScheduledWorldCycle,
  runStewardshipCaretakerRecruitment,
  STEWARDSHIP_CARETAKER_DATES,
  STEWARDSHIP_CARETAKER_TERM_WEEKS,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/memory-world-repository.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  createWorld,
  currentRosterPersonIds,
  minimumViableRoster,
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

function thinRoster(aggregate: ApplicationWorldAggregate, promotionId: string, deficit: number): number {
  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === promotionId)!;
  const floor = minimumViableRoster(aggregate.state, promotion);
  const target = Math.max(0, floor - deficit);
  let guard = 0;
  while (currentRosterPersonIds(aggregate.state, promotionId).length > target) {
    guard += 1;
    if (guard > 100) throw new Error("caretaker fixture could not thin roster");
    const contract = activeContractsForPromotion(aggregate.state, promotionId)
      .find((candidate) => candidate.status === "SIGNED");
    if (!contract) throw new Error("caretaker fixture ran out of contracts while thinning roster");
    contract.status = "TERMINATED";
  }
  return floor;
}

function fixture(seed: number, deficit = 2, initiallyStewarded = true): {
  aggregate: ApplicationWorldAggregate;
  playerId: string;
  promotionId: string;
  floor: number;
  freeAgentIdsBefore: Set<string>;
} {
  const ruleset = { ...DEFAULT_RULESET, offerAcceptanceThreshold: 0 };
  const state = createWorld(seed, ruleset);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const playerId = "caretaker-owner";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);

  const promotion = state.promotions.find((candidate) => (
    candidate.controllerType === "AI"
    && candidate.tier === "INDEPENDENT"
    && candidate.lifecycle === "ACTIVE"
  ));
  if (!promotion) throw new Error("caretaker fixture could not find an Independent promotion");
  claimIndependentPromotionForPlayer(state, ownership, playerId, promotion.id);
  promotion.cash = Math.max(promotion.cash, 100_000_000);
  promotion.financialDistress = "HEALTHY";

  const engagement = createWorldEngagementState(state.world.id);
  recordPlayerActivity(engagement, playerId, state.world.currentDate, 0, "2026-09-01");
  const activity = engagement.playerActivity.find((record) => record.playerId === playerId)!;
  if (initiallyStewarded) {
    activity.status = "STEWARDED";
    activity.statusSinceCycleKey = "2026-09-15";
  }

  const aggregate: ApplicationWorldAggregate = {
    state,
    ownership,
    commands: createWorldCommandState(state.world.id),
    runtime: createWorldRuntimeState(state.world.id),
    planning: createWorldPlanningState(state.world.id),
    engagement,
  };
  const floor = thinRoster(aggregate, promotion.id, deficit);
  const freeAgentIdsBefore = new Set(
    state.people
      .filter((person) => person.status === "ACTIVE")
      .filter((person) => activeContractsForPerson(state, person.id).length === 0)
      .map((person) => person.id),
  );
  return { aggregate, playerId, promotionId: promotion.id, floor, freeAgentIdsBefore };
}

await test("Stewardship caretaker recruits only to the minimum viable roster with short non-exclusive bridge deals", () => {
  const f = fixture(18501, 2);
  const beforeContracts = f.aggregate.state.contracts.length;
  const result = runStewardshipCaretakerRecruitment(f.aggregate, "2026-10-04");

  equal(result.promotionsUnderstaffed, 1, "understaffed stewarded promotion was not identified");
  equal(result.cyclesProcessed, 1, "caretaker cycle was not processed exactly once");
  equal(result.signedContracts, 2, "caretaker did not repair the two-person roster deficit");
  equal(currentRosterPersonIds(f.aggregate.state, f.promotionId).length, f.floor, "caretaker recruited beyond or below minimum viable roster");

  const signed = f.aggregate.state.contracts.slice(beforeContracts);
  equal(signed.length, 2, "unexpected number of caretaker contracts created");
  for (const contract of signed) {
    ok(f.freeAgentIdsBefore.has(contract.personId), "caretaker signed talent who was not a genuine free agent");
    equal(contract.family, "LIMITED_NON_EXCLUSIVE", "caretaker used the wrong contract family");
    equal(contract.exclusivity, "NON_EXCLUSIVE", "caretaker created an exclusive contract");
    equal(contract.dateEntitlement, STEWARDSHIP_CARETAKER_DATES, "caretaker date entitlement mismatch");
    equal(contract.signingBonus, 0, "caretaker paid a signing bonus");
    equal(
      weeksBetween(contract.startDate, contract.endDate, f.aggregate.state.ruleset.weeksPerYear) + 1,
      STEWARDSHIP_CARETAKER_TERM_WEEKS,
      "caretaker bridge term length mismatch",
    );
    const person = f.aggregate.state.people.find((candidate) => candidate.id === contract.personId)!;
    ok(person.careerStage !== "SPECIAL_ATTRACTION", "caretaker recruited a special attraction");
    const sourceOffer = f.aggregate.state.contractOffers.find((offer) => offer.id === contract.sourceOfferId);
    equal(sourceOffer?.status, "ACCEPTED", "caretaker contract was not backed by an accepted offer");
  }
});

await test("Stewardship caretaker is idempotent within a real cycle even when the roster remains below its floor", () => {
  const f = fixture(18502, 4);
  const first = runStewardshipCaretakerRecruitment(f.aggregate, "2026-10-04");
  equal(first.signedContracts, f.aggregate.state.ruleset.survivalEmergencyRecruitmentPerCycle, "first caretaker cycle ignored signing cap");
  ok(currentRosterPersonIds(f.aggregate.state, f.promotionId).length < f.floor, "fixture did not retain a deficit after the capped first pass");

  const contractsAfterFirst = f.aggregate.state.contracts.length;
  const offersAfterFirst = f.aggregate.state.contractOffers.length;
  const retry = runStewardshipCaretakerRecruitment(f.aggregate, "2026-10-04");
  equal(retry.cyclesProcessed, 0, "duplicate caretaker cycle was processed twice");
  equal(retry.signedContracts, 0, "duplicate caretaker cycle created more contracts");
  equal(f.aggregate.state.contracts.length, contractsAfterFirst, "duplicate caretaker cycle changed contract count");
  equal(f.aggregate.state.contractOffers.length, offersAfterFirst, "duplicate caretaker cycle submitted more offers");
});

await test("returning owner immediately disables caretaker recruitment", () => {
  const f = fixture(18503, 2);
  recordPlayerActivity(
    f.aggregate.engagement!,
    f.playerId,
    f.aggregate.state.world.currentDate,
    f.aggregate.runtime.revision,
    "2026-10-04",
  );
  const before = f.aggregate.state.contracts.length;
  const result = runStewardshipCaretakerRecruitment(f.aggregate, "2026-10-04");
  equal(result.signedContracts, 0, "caretaker recruited after owner returned ACTIVE");
  equal(f.aggregate.state.contracts.length, before, "returning owner did not stop caretaker contract creation");
});

await test("caretaker does not prop up a promotion already in financial CRISIS", () => {
  const f = fixture(18504, 2);
  const promotion = f.aggregate.state.promotions.find((candidate) => candidate.id === f.promotionId)!;
  promotion.financialDistress = "CRISIS";
  const before = f.aggregate.state.contracts.length;
  const result = runStewardshipCaretakerRecruitment(f.aggregate, "2026-10-04");
  equal(result.signedContracts, 0, "caretaker recruited during financial CRISIS");
  equal(f.aggregate.state.contracts.length, before, "financial CRISIS was insulated by caretaker recruitment");
});

await test("daily scheduler invokes caretaker after inactivity becomes Stewardship", async () => {
  const f = fixture(18505, 2, false);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(f.aggregate);

  const result = await resolveScheduledWorldCycle(repository, f.aggregate.state.world.id, "2026-10-04");
  const after = await repository.load(f.aggregate.state.world.id);
  ok(result.status === "RESOLVED", "scheduler did not resolve caretaker fixture World");
  const cycleEntry = after.state.ledger.find((entry) => (
    entry.type === "STEWARDSHIP_CARETAKER_RECRUITMENT_CYCLE"
    && entry.entityIds[0] === f.promotionId
    && String(entry.payload.cycleKey ?? "") === "2026-10-04"
  ));
  ok(cycleEntry, "scheduled worker did not execute the Stewardship caretaker cycle");
  ok(Number(cycleEntry?.payload.signedContracts ?? 0) > 0, "scheduled caretaker did not recruit into the roster deficit");
});

console.log(`\nStewardship caretaker tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
