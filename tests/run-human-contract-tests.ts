declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WorldState } from "../packages/domain/src/types.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  addPpwWeeks,
  buildContractTerms,
  contractHasAppearanceRights,
  DeterministicRng,
  claimIndependentPromotionForHuman,
  createWorld,
  marketWeeklyValue,
  resolveContractOffers,
  resolveWorldWeek,
  submitHumanContractOffer,
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

function fixture(seed: number): { state: WorldState; promotionId: string; freeAgentId: string } {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionForHuman(state, promotion.id, { name: "Player Wrestling" });
  const freeAgent = state.people.find(
    (person) => person.status === "ACTIVE" && activeContractsForPerson(state, person.id).length === 0,
  )!;
  ok(Boolean(freeAgent), "expected an active free agent at Genesis");
  return { state, promotionId: promotion.id, freeAgentId: freeAgent.id };
}

test("human promoter can submit exact recruitment terms without AI rewriting them", () => {
  const { state, promotionId, freeAgentId } = fixture(11001);
  const endDate = addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear);
  const offer = submitHumanContractOffer(state, {
    promotionId,
    personId: freeAgentId,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "FEATURED",
    startDate: { ...state.world.currentDate },
    endDate,
    dateEntitlement: 4,
    weeklyGuarantee: 12_000,
    appearanceFee: 6_500,
    signingBonus: 8_000,
  });

  ok(offer.status === "PENDING", "human offer was not submitted as pending");
  ok(offer.offerKind === "RECRUITMENT", "first relationship offer was not classified as recruitment");
  ok(offer.weeklyGuarantee === 12_000, "weekly guarantee was rewritten");
  ok(offer.appearanceFee === 6_500, "appearance fee was rewritten");
  ok(offer.dateEntitlement === 4, "purchased dates were rewritten");
  ok(state.contractOffers[state.contractOffers.length - 1] === offer, "offer was not appended to the shared market");
  ok(state.ledger[state.ledger.length - 1]!.type === "HUMAN_CONTRACT_OFFER_SUBMITTED", "offer was not recorded in World history");
});

test("a strong human offer resolves through the normal wrestler decision system and becomes a real contract", () => {
  const { state, promotionId, freeAgentId } = fixture(11002);
  const person = state.people.find((candidate) => candidate.id === freeAgentId)!;
  const market = marketWeeklyValue(person);
  const offer = submitHumanContractOffer(state, {
    promotionId,
    personId: freeAgentId,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: "MAIN_EVENT",
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 2,
    weeklyGuarantee: market * 4,
    appearanceFee: market * 4,
    signingBonus: market * 12,
  });

  resolveWorldWeek(state);

  ok(offer.resolvedUtility !== null, "wrestler never evaluated the human offer");
  ok(offer.status === "ACCEPTED", `strong human offer finished as ${offer.status}`);
  const contract = state.contracts.find((candidate) => candidate.sourceOfferId === offer.id);
  ok(Boolean(contract), "accepted human offer did not create a real contract");
  ok(contract!.promotionId === promotionId && contract!.personId === freeAgentId, "accepted contract points at wrong parties");
  ok(contract!.weeklyGuarantee === offer.weeklyGuarantee, "signed contract does not preserve human-negotiated money");
});

test("an existing wrestler relationship is classified as a renewal", () => {
  const { state, promotionId } = fixture(11003);
  const current = activeContractsForPromotion(state, promotionId).find(
    (contract) => activeContractsForPerson(state, contract.personId).length === 1,
  )!;
  ok(Boolean(current), "expected a singly contracted wrestler for renewal test");
  const startDate = addPpwWeeks(current.endDate, 1, state.ruleset.weeksPerYear);

  const offer = submitHumanContractOffer(state, {
    promotionId,
    personId: current.personId,
    family: "ONE_OFF",
    exclusivity: "OPEN",
    roleExpectation: current.roleExpectation,
    startDate,
    endDate: { ...startDate },
    dateEntitlement: 1,
    weeklyGuarantee: 0,
    appearanceFee: Math.max(1, current.appearanceFee || current.weeklyGuarantee),
    signingBonus: 0,
  });

  ok(offer.offerKind === "RENEWAL", "existing relationship was incorrectly classified as recruitment");
});

test("an exhausted limited-date deal can be replaced immediately without stacking contracts", () => {
  const { state, promotionId } = fixture(11006);
  const source = activeContractsForPromotion(state, promotionId).find((contract) => contract.family !== "ONE_OFF")!;
  ok(Boolean(source), "expected a renewable limited-date contract");
  source.datesUsed = source.dateEntitlement;
  const person = state.people.find((candidate) => candidate.id === source.personId)!;
  const market = marketWeeklyValue(person);
  const offer = submitHumanContractOffer(state, {
    promotionId,
    personId: source.personId,
    sourceContractId: source.id,
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: source.roleExpectation,
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 5,
    weeklyGuarantee: market * 4,
    appearanceFee: market * 4,
    signingBonus: market * 12,
  });

  ok(offer.offerKind === "RENEWAL", "exhausted replacement was not classified as renewal");
  ok(offer.sourceContractId === source.id, "exhausted replacement lost its source contract");
  resolveContractOffers(state);
  ok(offer.status === "ACCEPTED", `strong exhausted-date replacement finished as ${offer.status}`);
  ok(source.status === "TERMINATED", "accepted exhausted replacement did not supersede the spent deal");
  const replacement = state.contracts.find((contract) => contract.sourceOfferId === offer.id);
  ok(Boolean(replacement) && replacement!.status === "SIGNED", "accepted exhausted replacement did not create a live contract");
  ok(replacement!.datesUsed === 0 && replacement!.dateEntitlement === 5, "replacement did not restore purchased dates");
  ok(activeContractsForPromotion(state, promotionId).filter((contract) => contract.personId === source.personId).length === 1, "exhausted replacement stacked multiple active contracts");
});

test("structurally impossible overlapping exclusive terms are rejected before submission", () => {
  const { state, promotionId } = fixture(11004);
  const current = activeContractsForPromotion(state, promotionId)[0]!;
  const offersBefore = state.contractOffers.length;

  let rejected = false;
  try {
    submitHumanContractOffer(state, {
      promotionId,
      personId: current.personId,
      family: "EXCLUSIVE",
      exclusivity: "EXCLUSIVE",
      roleExpectation: "MAIN_EVENT",
      startDate: { ...state.world.currentDate },
      endDate: addPpwWeeks(state.world.currentDate, 25, state.ruleset.weeksPerYear),
      dateEntitlement: 16,
      weeklyGuarantee: 50_000,
      appearanceFee: 0,
      signingBonus: 50_000,
    });
  } catch {
    rejected = true;
  }

  ok(rejected, "overlapping exclusive human offer was accepted into the market");
  ok(state.contractOffers.length === offersBefore, "rejected contract offer partially mutated World state");
});

test("AI promotions cannot use the human contract command", () => {
  const { state, freeAgentId } = fixture(11005);
  const aiPromotion = state.promotions.find((promotion) => promotion.controllerType === "AI" && promotion.lifecycle === "ACTIVE")!;

  let rejected = false;
  try {
    submitHumanContractOffer(state, {
      promotionId: aiPromotion.id,
      personId: freeAgentId,
      family: "ONE_OFF",
      exclusivity: "OPEN",
      roleExpectation: "REGULAR",
      startDate: { ...state.world.currentDate },
      endDate: { ...state.world.currentDate },
      dateEntitlement: 1,
      weeklyGuarantee: 0,
      appearanceFee: 10_000,
      signingBonus: 0,
    });
  } catch {
    rejected = true;
  }
  ok(rejected, "AI promotion could invoke a human-only contract command");
});

test("exclusive appearance rights survive exhausting the legacy date count, non-exclusive dates do not", () => {
  const { state, promotionId, freeAgentId } = fixture(11007);
  const promotion = state.promotions.find((entry) => entry.id === promotionId)!;
  const person = state.people.find((entry) => entry.id === freeAgentId)!;
  const exclusive = buildContractTerms(
    state, promotion, person, new DeterministicRng(11007), state.world.currentDate, "EXCLUSIVE",
  );
  ok(exclusive.family === "EXCLUSIVE" && exclusive.exclusivity === "EXCLUSIVE",
    "forced exclusive proposal changed contractual employment type");
  ok(exclusive.weeklyGuarantee > 0 && exclusive.appearanceFee === 0,
    "exclusive employment lost guaranteed pay or invented an appearance charge");
  ok(contractHasAppearanceRights({ family: "EXCLUSIVE", dateEntitlement: 1, datesUsed: 600 }),
    "exclusive wrestler became unbookable despite an active exclusive term");
  ok(contractHasAppearanceRights({ family: "EXCLUSIVE", dateEntitlement: 26, datesUsed: 26 }),
    "exclusive booking rights were incorrectly limited by a legacy numeric entitlement");
  ok(contractHasAppearanceRights({ family: "LIMITED_NON_EXCLUSIVE", dateEntitlement: 6, datesUsed: 5 }),
    "non-exclusive booking was denied before all six purchased dates were used");
  ok(!contractHasAppearanceRights({ family: "LIMITED_NON_EXCLUSIVE", dateEntitlement: 6, datesUsed: 6 }),
    "non-exclusive agreement allowed an unpaid seventh appearance");
  ok(!contractHasAppearanceRights({ family: "ONE_OFF", dateEntitlement: 1, datesUsed: 1 }),
    "one-off agreement allowed a second appearance");
});

console.log(`\nHuman contract tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
