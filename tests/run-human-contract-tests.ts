declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WorldState } from "../packages/domain/src/types.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  addPpwWeeks,
  claimIndependentPromotionForHuman,
  createWorld,
  marketWeeklyValue,
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

console.log(`\nHuman contract tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
